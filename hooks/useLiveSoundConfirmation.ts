import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { LiveSoundChunkSender } from "@/lib/liveSoundChunkSender";
import type { IdentifyResult } from "@/lib/identify";
import { useIdentificationLocation } from "@/hooks/useIdentificationLocation";
import {
  buildOverlappedAnalyzeUri,
  liveRotateIntervalMs,
} from "@/lib/audioChunkOverlap";
import {
  displayDetections,
  highlightSpeciesKeysFromChunk,
  LIVE_DETECTION_TTL_MS,
  LIVE_MIN_RECORDING_MS,
  mergeChunkPredictions,
  pickSessionTop,
  predictionsFromDetections,
  type LiveDetection,
  type SessionSegment,
} from "@/lib/liveSoundSession";
import {
  getRegionalContext,
  type NativeLogitInput,
} from "@/lib/regionalFrequency";
import { prefetchRegionalCommunity } from "@/lib/regionalCommunity";
import type { Prediction } from "@/types";

const PCM_SAMPLE_RATE = 44100;
const PCM_BIT_RATE = PCM_SAMPLE_RATE * 16;

const RECORDING_OPTIONS: RecordingOptions =
  Platform.OS === "android"
    ? {
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      }
    : {
        isMeteringEnabled: true,
        extension: ".wav",
        sampleRate: PCM_SAMPLE_RATE,
        numberOfChannels: 1,
        bitRate: PCM_BIT_RATE,
        ios: {
          extension: ".wav",
          outputFormat: IOSOutputFormat.LINEARPCM,
          audioQuality: AudioQuality.MAX,
          sampleRate: PCM_SAMPLE_RATE,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          extension: ".m4a",
          outputFormat: "mpeg4",
          audioEncoder: "aac",
          sampleRate: PCM_SAMPLE_RATE,
        },
        web: {
          mimeType: "audio/wav",
          bitsPerSecond: PCM_BIT_RATE,
        },
      };

interface PendingSession {
  segments: SessionSegment[];
  detections: Map<string, LiveDetection>;
  coords: { latitude: number; longitude: number } | null;
  observedAt: string;
  latestNativeLogits?: NativeLogitInput[];
  lastChunkSpeciesKeys: Set<string>;
}

export type LiveSoundDisplayRow = {
  detection: LiveDetection;
  isExpiring: boolean;
  isHeardNow: boolean;
};

export interface SoundConfirmationSnapshot {
  primary: LiveDetection | null;
  predictions: Prediction[];
}

export interface UseLiveSoundConfirmationResult {
  enabled: boolean;
  isActive: boolean;
  isProcessing: boolean;
  chunkWarning: string | null;
  primaryDetection: LiveDetection | null;
  displayRows: LiveSoundDisplayRow[];
  toggle: () => Promise<void>;
  settle: () => Promise<SoundConfirmationSnapshot>;
  stop: () => Promise<void>;
}

export function useLiveSoundConfirmation(): UseLiveSoundConfirmationResult {
  const [enabled, setEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunkWarning, setChunkWarning] = useState<string | null>(null);
  const [displayRows, setDisplayRows] = useState<LiveSoundDisplayRow[]>([]);

  const { refresh: refreshLocation } = useIdentificationLocation({
    enabled,
  });

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recordingActiveRef = useRef(false);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<PendingSession | null>(null);
  const activeRef = useRef(false);
  const chunkSenderRef = useRef(new LiveSoundChunkSender());
  const previousSegmentUriRef = useRef<string | null>(null);
  const segmentStartedAtRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

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

  const updateProcessing = useCallback(() => {
    if (!activeRef.current) {
      setIsProcessing(false);
      return;
    }
    setIsProcessing(
      chunkSenderRef.current.inFlight > 0 || chunkSenderRef.current.queued > 0,
    );
  }, []);

  const handleChunkOutcome = useCallback(
    (
      outcome:
        | { ok: true; result: IdentifyResult }
        | { ok: false; reason: string },
    ) => {
      if (outcome.ok && sessionRef.current) {
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
        return;
      }

      if (!outcome.ok) {
        console.warn("[LiveSoundConfirmation] chunk failed:", outcome.reason);
      }
    },
    [refreshDetections],
  );

  const processChunk = useCallback(
    (
      uri: string,
      durationMs: number,
      analyzeUri?: string,
      analyzeDurationMs?: number,
    ) => {
      const session = sessionRef.current;
      if (!session) return;

      session.segments.push({ uri, durationMs });

      const uploadDurationMs = analyzeDurationMs ?? durationMs;
      if (uploadDurationMs < LIVE_MIN_RECORDING_MS) return;

      updateProcessing();
      chunkSenderRef.current.submit(
        {
          uploadUri: analyzeUri ?? uri,
          geo: {
            lat: session.coords?.latitude ?? null,
            lng: session.coords?.longitude ?? null,
            observedAt: session.observedAt,
          },
        },
        (outcome) => {
          handleChunkOutcome(outcome);
          updateProcessing();
        },
      );
    },
    [handleChunkOutcome, updateProcessing],
  );

  const stopCurrentRecording = useCallback(async (): Promise<SessionSegment | null> => {
    if (!recordingActiveRef.current) return null;

    recordingActiveRef.current = false;
    const startedAt = segmentStartedAtRef.current;
    segmentStartedAtRef.current = null;

    try {
      // Duration must be read before stop(); expo-audio resets it on stop.
      const statusBefore = recorder.getStatus();
      await recorder.stop();
      const uri = recorder.uri;
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
  }, [recorder]);

  const startRecordingSegment = useCallback(async (): Promise<boolean> => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
      });

      // Passing options on every prepare gives each segment a fresh output file.
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      recordingActiveRef.current = true;
      segmentStartedAtRef.current = Date.now();
      return true;
    } catch {
      recordingActiveRef.current = false;
      return false;
    }
  }, [recorder]);

  const rotateSegment = useCallback(async () => {
    if (!activeRef.current) return;

    const segment = await stopCurrentRecording();
    if (segment) {
      const overlapped = await buildOverlappedAnalyzeUri(
        previousSegmentUriRef.current,
        segment.uri,
        segment.durationMs,
      );
      previousSegmentUriRef.current = segment.uri;
      processChunk(
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
      setEnabled(false);
      return;
    }

    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      void rotateSegment();
    }, liveRotateIntervalMs());
  }, [clearMeteringTimer, clearSegmentTimer, processChunk, startRecordingSegment, stopCurrentRecording]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const permission = await getRecordingPermissionsAsync();
    if (permission.granted) return true;
    const requested = await requestRecordingPermissionsAsync();
    return requested.granted;
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    clearSegmentTimer();
    clearMeteringTimer();
    clearPruneTimer();
    void stopCurrentRecording();
    sessionRef.current = null;
    previousSegmentUriRef.current = null;
    chunkSenderRef.current = new LiveSoundChunkSender();
    setEnabled(false);
    setIsProcessing(false);
    setChunkWarning(null);
    setDisplayRows([]);
  }, [clearMeteringTimer, clearPruneTimer, clearSegmentTimer, stopCurrentRecording]);

  const flushPendingChunks = useCallback(async () => {
    const finalSegment = await stopCurrentRecording();
    if (finalSegment && sessionRef.current) {
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

    await chunkSenderRef.current.waitForIdle(20_000);
  }, [processChunk, stopCurrentRecording]);

  const snapshotFromSession = useCallback((): SoundConfirmationSnapshot => {
    const session = sessionRef.current;
    if (!session) {
      return { primary: null, predictions: [] };
    }
    const primary = pickSessionTop(
      session.detections,
      session.coords,
      session.observedAt,
    );
    const predictions = predictionsFromDetections(
      session.detections,
      session.coords,
      session.observedAt,
    );
    return { primary, predictions };
  }, []);

  const startListening = useCallback(async () => {
    if (activeRef.current) return;

    const granted = await requestMicPermission();
    if (!granted) return;

    const now = new Date().toISOString();
    const coords = await refreshLocation();

    if (coords) {
      void prefetchRegionalCommunity(
        getRegionalContext(coords.latitude, coords.longitude, new Date(now)),
      );
    }

    sessionRef.current = {
      segments: [],
      detections: new Map(),
      coords,
      observedAt: now,
      lastChunkSpeciesKeys: new Set(),
    };
    previousSegmentUriRef.current = null;
    activeRef.current = true;
    setEnabled(true);
    setChunkWarning(null);
    setDisplayRows([]);

    const started = await startRecordingSegment();
    if (!started) {
      reset();
      return;
    }

    clearPruneTimer();
    pruneTimerRef.current = setInterval(() => {
      refreshDetections();
    }, 500);

    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      void rotateSegment();
    }, liveRotateIntervalMs());
  }, [
    clearPruneTimer,
    clearSegmentTimer,
    refreshDetections,
    refreshLocation,
    requestMicPermission,
    reset,
    rotateSegment,
    startRecordingSegment,
  ]);

  const stopListening = useCallback(async () => {
    if (!activeRef.current && !sessionRef.current) {
      reset();
      return;
    }

    activeRef.current = false;
    clearSegmentTimer();
    clearMeteringTimer();
    clearPruneTimer();
    setIsProcessing(true);
    await flushPendingChunks();
    reset();
  }, [
    clearMeteringTimer,
    clearPruneTimer,
    clearSegmentTimer,
    flushPendingChunks,
    reset,
  ]);

  const settle = useCallback(async (): Promise<SoundConfirmationSnapshot> => {
    if (!activeRef.current && !sessionRef.current) {
      return snapshotFromSession();
    }

    activeRef.current = false;
    clearSegmentTimer();
    clearMeteringTimer();
    clearPruneTimer();
    setIsProcessing(true);
    await flushPendingChunks();
    refreshDetections();

    const snapshot = snapshotFromSession();
    reset();
    return snapshot;
  }, [
    clearMeteringTimer,
    clearPruneTimer,
    clearSegmentTimer,
    flushPendingChunks,
    refreshDetections,
    reset,
    snapshotFromSession,
  ]);

  const toggle = useCallback(async () => {
    if (enabledRef.current) {
      await stopListening();
      return;
    }
    await startListening();
  }, [startListening, stopListening]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearSegmentTimer();
      clearMeteringTimer();
      clearPruneTimer();
      if (recordingActiveRef.current) {
        recordingActiveRef.current = false;
        void recorder.stop().catch(() => undefined);
      }
    };
  }, [clearMeteringTimer, clearPruneTimer, clearSegmentTimer, recorder]);

  const primaryDetection =
    displayRows.find((row) => row.isHeardNow && !row.isExpiring)?.detection ??
    displayRows.find((row) => !row.isExpiring)?.detection ??
    null;

  return {
    enabled,
    isActive: enabled,
    isProcessing,
    chunkWarning,
    primaryDetection,
    displayRows,
    toggle,
    settle,
    stop: stopListening,
  };
}
