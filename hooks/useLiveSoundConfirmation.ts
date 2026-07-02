import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import {
  AndroidAudioEncoder,
  AndroidOutputFormat,
  IOSAudioQuality,
  IOSOutputFormat,
} from "expo-av/build/Audio/RecordingConstants";
import { identifyAudioChunkSafe } from "@/lib/identify";
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

const MAX_IN_FLIGHT_CHUNKS = 2;
const PCM_SAMPLE_RATE = 44100;
const PCM_BIT_RATE = PCM_SAMPLE_RATE * 16;

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
  primaryDetection: LiveDetection | null;
  displayRows: LiveSoundDisplayRow[];
  toggle: () => Promise<void>;
  settle: () => Promise<SoundConfirmationSnapshot>;
  stop: () => Promise<void>;
}

export function useLiveSoundConfirmation(): UseLiveSoundConfirmationResult {
  const [enabled, setEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayRows, setDisplayRows] = useState<LiveSoundDisplayRow[]>([]);

  const { refresh: refreshLocation } = useIdentificationLocation({
    enabled,
  });

  const recordingRef = useRef<Audio.Recording | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<PendingSession | null>(null);
  const activeRef = useRef(false);
  const pendingChunksRef = useRef(0);
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
    setIsProcessing(pendingChunksRef.current > 0);
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
      if (uploadDurationMs < LIVE_MIN_RECORDING_MS) return;
      if (pendingChunksRef.current >= MAX_IN_FLIGHT_CHUNKS) return;

      pendingChunksRef.current += 1;
      updateProcessing();

      try {
        const outcome = await identifyAudioChunkSafe(analyzeUri ?? uri, {
          lat: session.coords?.latitude ?? null,
          lng: session.coords?.longitude ?? null,
          observedAt: session.observedAt,
        });
        if (outcome.ok && sessionRef.current) {
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
        }
      } finally {
        pendingChunksRef.current = Math.max(0, pendingChunksRef.current - 1);
        updateProcessing();
      }
    },
    [refreshDetections, updateProcessing],
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
      const overlapped = await buildOverlappedAnalyzeUri(
        previousSegmentUriRef.current,
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
      setEnabled(false);
      return;
    }

    clearSegmentTimer();
    segmentTimerRef.current = setTimeout(() => {
      void rotateSegment();
    }, liveRotateIntervalMs());
  }, [clearMeteringTimer, clearSegmentTimer, processChunk, startRecordingSegment, stopCurrentRecording]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    const permission = await Audio.getPermissionsAsync();
    if (permission.granted) return true;
    const requested = await Audio.requestPermissionsAsync();
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
    pendingChunksRef.current = 0;
    setEnabled(false);
    setIsProcessing(false);
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

    const deadline = Date.now() + 20_000;
    while (pendingChunksRef.current > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
    };
  }, [clearMeteringTimer, clearPruneTimer, clearSegmentTimer]);

  const primaryDetection =
    displayRows.find((row) => row.isHeardNow && !row.isExpiring)?.detection ??
    displayRows.find((row) => !row.isExpiring)?.detection ??
    null;

  return {
    enabled,
    isActive: enabled,
    isProcessing,
    primaryDetection,
    displayRows,
    toggle,
    settle,
    stop: stopListening,
  };
}
