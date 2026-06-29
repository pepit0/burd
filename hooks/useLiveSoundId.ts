import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import {
  AndroidAudioEncoder,
  AndroidOutputFormat,
  IOSAudioQuality,
  IOSOutputFormat,
} from "expo-av/build/Audio/RecordingConstants";
import { identifyAudioChunkSafe, type IdentifyResult } from "@/lib/identify";
import { useIdentificationLocation } from "@/hooks/useIdentificationLocation";
import {
  buildLiveSessionReview,
  displayDetections,
  highlightSpeciesKeysFromChunk,
  LIVE_DETECTION_TTL_MS,
  LIVE_MIN_RECORDING_MS,
  mergeChunkPredictions,
  saveLiveSessionToJournal,
  type FinalizeLiveSessionResult,
  type LiveDetection,
  type LiveSessionReview,
  type SessionSegment,
} from "@/lib/liveSoundSession";
import {
  getRegionalContext,
  type NativeLogitInput,
} from "@/lib/regionalFrequency";
import type { LocationPermissionState } from "@/lib/locationPermission";
import { prefetchRegionalCommunity } from "@/lib/regionalCommunity";
import {
  setPendingCapture,
  type PendingCapture,
} from "@/lib/pendingCapture";
import { enrichPrediction } from "@/lib/predictionLabels";
import {
  buildOverlappedAnalyzeUri,
  liveRotateIntervalMs,
  LIVE_WINDOW_MS,
} from "@/lib/audioChunkOverlap";

export const LIVE_CHUNK_SECONDS = LIVE_WINDOW_MS / 1000;

const MAX_IN_FLIGHT_CHUNKS = 2;

export type LiveSoundStatus =
  | "idle"
  | "listening"
  | "processing"
  | "review"
  | "saving"
  | "done"
  | "error";

export type MicPermissionState = "undetermined" | "granted" | "denied";

const PCM_SAMPLE_RATE = 44100;
const PCM_BIT_RATE = PCM_SAMPLE_RATE * 16;

/** Fix 5: Android uses reliable AAC; iOS uses linear PCM WAV for Perch. */
const RECORDING_OPTIONS: Audio.RecordingOptions =
  Platform.OS === "android"
    ? {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      }
    : {
        isMeteringEnabled: true,
        ios: {
          extension: ".wav",
          outputFormat: IOSOutputFormat.LINEARPCM,
          audioQuality: IOSAudioQuality.MAX,
          sampleRate: PCM_SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: PCM_BIT_RATE,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          extension: ".m4a",
          outputFormat: AndroidOutputFormat.MPEG_4,
          audioEncoder: AndroidAudioEncoder.AAC,
          sampleRate: PCM_SAMPLE_RATE,
          numberOfChannels: 1,
          bitRate: PCM_BIT_RATE,
        },
        web: {
          mimeType: "audio/wav",
          bitsPerSecond: PCM_BIT_RATE,
        },
      };

function normalizeMetering(metering: number | undefined): number {
  if (metering == null || Number.isNaN(metering)) return 0;
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}

interface PendingSession {
  segments: SessionSegment[];
  detections: Map<string, LiveDetection>;
  coords: { latitude: number; longitude: number } | null;
  recordedAt: string;
  observedAt: string;
  failedChunks: number;
  lastChunkError: string | null;
  latestNativeLogits?: NativeLogitInput[];
  lastChunkSpeciesKeys: Set<string>;
}

export type LiveDisplayRow = {
  detection: LiveDetection;
  isExpiring: boolean;
  isHeardNow: boolean;
};

export interface UseLiveSoundIdResult {
  status: LiveSoundStatus;
  statusLabel: string;
  micPermission: MicPermissionState;
  locationPermission: LocationPermissionState;
  meteringLevel: number;
  displayRows: LiveDisplayRow[];
  sessionReview: LiveSessionReview | null;
  selectedPrimaryKey: string | null;
  setSelectedPrimaryKey: (key: string) => void;
  sessionResult: FinalizeLiveSessionResult | null;
  errorMessage: string | null;
  chunkWarning: string | null;
  isActive: boolean;
  requestMicPermission: () => Promise<boolean>;
  requestLocationPermission: () => Promise<boolean>;
  openLocationSettings: () => void;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  saveToJournal: () => Promise<void>;
  discardSession: () => void;
  handoffToNewSighting: () => boolean;
  retrySave: () => Promise<void>;
  resetSession: () => void;
}

function sessionDurationMs(
  segments: SessionSegment[],
  recordedAt: string,
): number {
  const segmentTotal = segments.reduce(
    (sum, segment) => sum + segment.durationMs,
    0,
  );
  const elapsedMs = Date.now() - new Date(recordedAt).getTime();
  return Math.max(segmentTotal, elapsedMs);
}

export function useLiveSoundId(userId: string | null): UseLiveSoundIdResult {
  const [status, setStatus] = useState<LiveSoundStatus>("idle");
  const [micPermission, setMicPermission] = useState<MicPermissionState>("undetermined");
  const [meteringLevel, setMeteringLevel] = useState(0);
  const [displayRows, setDisplayRows] = useState<LiveDisplayRow[]>([]);
  const [sessionReview, setSessionReview] = useState<LiveSessionReview | null>(
    null,
  );
  const [selectedPrimaryKey, setSelectedPrimaryKey] = useState<string | null>(
    null,
  );
  const [sessionResult, setSessionResult] = useState<FinalizeLiveSessionResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chunkWarning, setChunkWarning] = useState<string | null>(null);

  const {
    permission: locationPermission,
    refresh: refreshLocation,
    openSettings: openLocationSettings,
  } = useIdentificationLocation();

  const recordingRef = useRef<Audio.Recording | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<PendingSession | null>(null);
  const activeRef = useRef(false);
  const pendingChunksRef = useRef(0);
  const previousSegmentUriRef = useRef<string | null>(null);
  const segmentStartedAtRef = useRef<number | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const clearMeteringTimer = useCallback(() => {
    if (meteringTimerRef.current) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
    }
  }, []);

  const clearPruneTimer = useCallback(() => {
    if (pruneTimerRef.current) {
      clearInterval(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
  }, []);

  const refreshDetections = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      setDisplayRows([]);
      return;
    }
    setDisplayRows(
      displayDetections(
        session.detections,
        Date.now(),
        session.coords,
        session.observedAt,
        LIVE_DETECTION_TTL_MS,
        800,
        session.latestNativeLogits,
      ).map((row) => ({
        ...row,
        isHeardNow: session.lastChunkSpeciesKeys.has(row.detection.key),
      })),
    );
  }, []);

  const updateStatusFromPending = useCallback(() => {
    if (!activeRef.current) return;
    if (pendingChunksRef.current > 0) {
      setStatus("processing");
      return;
    }
    setStatus("listening");
  }, []);

  const processChunk = useCallback(
    async (
      uri: string,
      durationMs: number,
      analyzeUri?: string,
      analyzeDurationMs?: number,
    ) => {
      const session = sessionRef.current;
      if (!session) return;

      session.segments.push({ uri, durationMs });

      const uploadDurationMs = analyzeDurationMs ?? durationMs;
      if (uploadDurationMs < LIVE_MIN_RECORDING_MS) {
        return;
      }

      if (pendingChunksRef.current >= MAX_IN_FLIGHT_CHUNKS) {
        return;
      }

      pendingChunksRef.current += 1;
      updateStatusFromPending();

      const uploadUri = analyzeUri ?? uri;

      try {
        const outcome = await identifyAudioChunkSafe(uploadUri, {
          lat: session.coords?.latitude ?? null,
          lng: session.coords?.longitude ?? null,
          observedAt: session.observedAt,
        });
        if (outcome.ok && sessionRef.current) {
          sessionRef.current.failedChunks = 0;
          sessionRef.current.lastChunkError = null;
          setChunkWarning(null);
          if (outcome.result.nativeLogits?.length) {
            sessionRef.current.latestNativeLogits = outcome.result.nativeLogits;
          }
          sessionRef.current.detections = mergeChunkPredictions(
            sessionRef.current.detections,
            outcome.result,
            Date.now(),
          );
          sessionRef.current.lastChunkSpeciesKeys = highlightSpeciesKeysFromChunk(
            outcome.result,
            sessionRef.current.coords,
            sessionRef.current.observedAt,
            sessionRef.current.latestNativeLogits,
          );
          refreshDetections();
        } else if (!outcome.ok && sessionRef.current) {
          sessionRef.current.failedChunks += 1;
          sessionRef.current.lastChunkError = outcome.reason;
          sessionRef.current.lastChunkSpeciesKeys = new Set();
          refreshDetections();
          if (__DEV__) {
            console.warn(
              `[LiveSoundId] chunk failed (${sessionRef.current.failedChunks}):`,
              outcome.reason,
            );
          }
          setChunkWarning(
            `Could not analyze audio: ${outcome.reason}`,
          );
        }
      } finally {
        pendingChunksRef.current = Math.max(0, pendingChunksRef.current - 1);
        updateStatusFromPending();
      }
    },
    [refreshDetections, updateStatusFromPending],
  );

  const stopCurrentRecording = useCallback(async (): Promise<SessionSegment | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;

    recordingRef.current = null;
    const startedAt = segmentStartedAtRef.current;
    segmentStartedAtRef.current = null;

    try {
      const statusBefore = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return null;

      let durationMs = statusBefore.durationMillis ?? 0;
      if (durationMs < 100 && startedAt != null) {
        durationMs = Date.now() - startedAt;
      }
      if (durationMs < 100) {
        durationMs = liveRotateIntervalMs();
      }

      return { uri, durationMs };
    } catch {
      return null;
    }
  }, []);

  const startRecordingSegment = useCallback(async (): Promise<boolean> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      segmentStartedAtRef.current = Date.now();
      return true;
    } catch {
      recordingRef.current = null;
      return false;
    }
  }, []);

  const rotateSegment = useCallback(async () => {
    if (!activeRef.current) return;

    const segment = await stopCurrentRecording();
    if (segment) {
      const previousUri = previousSegmentUriRef.current;
      const overlapped = await buildOverlappedAnalyzeUri(
        previousUri,
        segment.uri,
        segment.durationMs,
      );
      previousSegmentUriRef.current = segment.uri;
      void processChunk(
        segment.uri,
        segment.durationMs,
        overlapped.uri,
        overlapped.durationMs,
      );
    }

    if (!activeRef.current) return;

    const started = await startRecordingSegment();
    if (!started) {
      activeRef.current = false;
      clearSegmentTimer();
      clearMeteringTimer();
      setStatus("error");
      setErrorMessage("Recording stopped unexpectedly.");
      return;
    }

    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      void rotateSegment();
    }, liveRotateIntervalMs());
  }, [
    clearMeteringTimer,
    clearSegmentTimer,
    processChunk,
    startRecordingSegment,
    stopCurrentRecording,
  ]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    const coords = await refreshLocation();
    return coords !== null;
  }, [refreshLocation]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const permission = await Audio.getPermissionsAsync();
    if (permission.granted) {
      setMicPermission("granted");
      return true;
    }

    const requested = await Audio.requestPermissionsAsync();
    const granted = requested.granted;
    setMicPermission(granted ? "granted" : "denied");
    return granted;
  }, []);

  const startSession = useCallback(async () => {
    if (!userIdRef.current || activeRef.current) return;

    const granted = await requestMicPermission();
    if (!granted) return;

    setSessionResult(null);
    setSessionReview(null);
    setSelectedPrimaryKey(null);
    setErrorMessage(null);
    setChunkWarning(null);
    setMeteringLevel(0);

    const now = new Date().toISOString();
    const coords = await refreshLocation();

    if (!coords) {
      setChunkWarning(
        "Location unavailable — species IDs may be inaccurate without GPS.",
      );
    }

    if (coords) {
      void prefetchRegionalCommunity(
        getRegionalContext(coords.latitude, coords.longitude, new Date(now)),
      );
    }

    sessionRef.current = {
      segments: [],
      detections: new Map(),
      coords,
      recordedAt: now,
      observedAt: now,
      failedChunks: 0,
      lastChunkError: null,
      lastChunkSpeciesKeys: new Set(),
    };
    previousSegmentUriRef.current = null;
    activeRef.current = true;
    setDisplayRows([]);
    setStatus("listening");

    const started = await startRecordingSegment();
    if (!started) {
      activeRef.current = false;
      sessionRef.current = null;
      setStatus("error");
      setErrorMessage("Could not start recording.");
      return;
    }

    clearPruneTimer();
    pruneTimerRef.current = setInterval(() => {
      refreshDetections();
    }, 500);

    clearMeteringTimer();
    meteringTimerRef.current = setInterval(async () => {
      const recording = recordingRef.current;
      if (!recording) {
        setMeteringLevel(0);
        return;
      }
      try {
        const recordingStatus = await recording.getStatusAsync();
        setMeteringLevel(normalizeMetering(recordingStatus.metering));
      } catch {
        setMeteringLevel(0);
      }
    }, 100);

    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      void rotateSegment();
    }, liveRotateIntervalMs());
  }, [
    refreshLocation,
    clearMeteringTimer,
    clearPruneTimer,
    clearSegmentTimer,
    refreshDetections,
    requestMicPermission,
    rotateSegment,
    startRecordingSegment,
  ]);

  const openReview = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.segments.length === 0) {
      setStatus("error");
      setErrorMessage("No audio was captured during this session.");
      return;
    }

    const totalDurationMs = sessionDurationMs(
      session.segments,
      session.recordedAt,
    );
    if (totalDurationMs < LIVE_MIN_RECORDING_MS) {
      setStatus("error");
      setErrorMessage("Record at least 1 second of audio before stopping.");
      return;
    }

    try {
      const review = buildLiveSessionReview({
        segments: session.segments,
        detections: session.detections,
        coords: session.coords,
        recordedAt: session.recordedAt,
        observedAt: session.observedAt,
      });
      setSessionReview(review);
      setSelectedPrimaryKey(review.top?.key ?? null);
      session.lastChunkSpeciesKeys = new Set();
      setDisplayRows([]);
      setSessionResult(null);
      setStatus("review");

      if (
        session.detections.size === 0 &&
        session.failedChunks > 0 &&
        session.lastChunkError
      ) {
        setChunkWarning(
          `No birds identified — ${session.failedChunks} chunk(s) failed. ${session.lastChunkError}`,
        );
      } else {
        setChunkWarning(null);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not review this session.",
      );
    }
  }, []);

  const persistSession = useCallback(async () => {
    const session = sessionRef.current;
    const uid = userIdRef.current;
    if (!session || !uid) {
      setStatus("error");
      setErrorMessage("Session data was lost.");
      return;
    }

    setStatus("saving");
    setErrorMessage(null);
    try {
      const result = await saveLiveSessionToJournal({
        userId: uid,
        segments: session.segments,
        detections: session.detections,
        coords: session.coords,
        recordedAt: session.recordedAt,
        observedAt: session.observedAt,
        primaryDetectionKey: selectedPrimaryKey,
      });
      setSessionResult(result);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save this session.",
      );
    }
  }, [selectedPrimaryKey]);

  const stopSession = useCallback(async () => {
    if (!activeRef.current) return;

    activeRef.current = false;
    clearSegmentTimer();
    clearMeteringTimer();
    clearPruneTimer();
    setMeteringLevel(0);
    setStatus("processing");

    const finalSegment = await stopCurrentRecording();
    if (finalSegment) {
      const overlapped = await buildOverlappedAnalyzeUri(
        previousSegmentUriRef.current,
        finalSegment.uri,
        finalSegment.durationMs,
      );
      previousSegmentUriRef.current = finalSegment.uri;
      await processChunk(
        finalSegment.uri,
        finalSegment.durationMs,
        overlapped.uri,
        overlapped.durationMs,
      );
    }

    const deadline = Date.now() + 30_000;
    while (pendingChunksRef.current > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    openReview();
  }, [
    clearMeteringTimer,
    clearPruneTimer,
    clearSegmentTimer,
    openReview,
    processChunk,
    stopCurrentRecording,
  ]);

  const resetSession = useCallback(() => {
    activeRef.current = false;
    clearSegmentTimer();
    clearMeteringTimer();
    clearPruneTimer();
    void stopCurrentRecording();
    sessionRef.current = null;
    previousSegmentUriRef.current = null;
    segmentStartedAtRef.current = null;
    pendingChunksRef.current = 0;
    setStatus("idle");
    setDisplayRows([]);
    setSessionResult(null);
    setSessionReview(null);
    setSelectedPrimaryKey(null);
    setErrorMessage(null);
    setChunkWarning(null);
    setMeteringLevel(0);
  }, [
    clearMeteringTimer,
    clearPruneTimer,
    clearSegmentTimer,
    stopCurrentRecording,
  ]);

  const saveToJournal = useCallback(async () => {
    await persistSession();
  }, [persistSession]);

  const discardSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  const handoffToNewSighting = useCallback((): boolean => {
    const session = sessionRef.current;
    if (!session || !sessionReview) return false;

    const primaryDetection =
      sessionReview.sessionDetections.find(
        (detection) => detection.key === selectedPrimaryKey,
      ) ?? sessionReview.top;
    const top = primaryDetection
      ? enrichPrediction(primaryDetection.prediction)
      : null;
    const capture: PendingCapture = {
      photos: [],
      primaryIndex: 0,
      audio: {
        uri: sessionReview.longestUri,
        durationMs: sessionReview.totalDurationMs,
        recordedAt: session.recordedAt,
      },
      analysis: top
        ? {
            detectedBy: "audio",
            top,
            agreed: false,
            imagePredictions: [],
            audioPredictions: sessionReview.sessionPredictions,
            heardSpecies: sessionReview.sessionPredictions,
            count: 1,
          }
        : undefined,
    };

    setPendingCapture(capture);
    resetSession();
    return true;
  }, [resetSession, selectedPrimaryKey, sessionReview]);

  const retrySave = useCallback(async () => {
    if (!sessionRef.current) return;
    await persistSession();
  }, [persistSession]);

  useEffect(() => {
    void Audio.getPermissionsAsync().then((permission) => {
      setMicPermission(
        permission.granted
          ? "granted"
          : permission.canAskAgain
            ? "undetermined"
            : "denied",
      );
    });

    return () => {
      activeRef.current = false;
      clearSegmentTimer();
      clearMeteringTimer();
      clearPruneTimer();
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
    };
  }, [clearMeteringTimer, clearPruneTimer, clearSegmentTimer]);

  const statusLabel =
    status === "listening"
      ? "Listening..."
      : status === "processing"
        ? "Processing..."
        : status === "review"
          ? "Save or discard?"
          : status === "saving"
          ? "Saving..."
          : status === "done"
            ? "Done"
            : status === "error"
              ? "Something went wrong"
              : "Tap to listen";

  return {
    status,
    statusLabel,
    micPermission,
    locationPermission,
    meteringLevel,
    displayRows,
    sessionReview,
    selectedPrimaryKey,
    setSelectedPrimaryKey,
    sessionResult,
    errorMessage,
    chunkWarning,
    isActive: status === "listening" || status === "processing",
    requestMicPermission,
    requestLocationPermission,
    openLocationSettings,
    startSession,
    stopSession,
    saveToJournal,
    discardSession,
    handoffToNewSighting,
    retrySave,
    resetSession,
  };
}
