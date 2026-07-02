import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CameraView } from "expo-camera";
import { identifyImageChunkSafe } from "@/lib/identify";
import { useIdentificationLocation } from "@/hooks/useIdentificationLocation";
import {
  displayPhotoDetections,
  highlightKeysFromPhotoFrame,
  LIVE_PHOTO_DETECTION_TTL_MS,
  LIVE_PHOTO_INTERVAL_MS,
  mergePhotoFramePredictions,
  type LivePhotoDetection,
  type LivePhotoDisplayRow,
} from "@/lib/livePhotoSession";

interface LivePhotoSession {
  detections: Map<string, LivePhotoDetection>;
  coords: { latitude: number; longitude: number } | null;
  observedAt: string;
  lastFrameKeys: Set<string>;
}

export interface UseLivePhotoIdResult {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  isScanning: boolean;
  isProcessing: boolean;
  displayRows: LivePhotoDisplayRow[];
  primaryDetection: LivePhotoDetection | null;
  scanError: string | null;
}

export function useLivePhotoId(
  cameraRef: RefObject<CameraView | null>,
  options?: { active?: boolean; paused?: boolean },
): UseLivePhotoIdResult {
  const cameraActive = options?.active ?? true;
  const paused = options?.paused ?? false;
  const [enabled, setEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayRows, setDisplayRows] = useState<LivePhotoDisplayRow[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const sessionRef = useRef<LivePhotoSession | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureInFlightRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const { refresh: refreshLocation } = useIdentificationLocation({
    enabled: enabled && cameraActive,
  });

  const clearScanTimer = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const clearPruneTimer = useCallback(() => {
    if (pruneTimerRef.current) {
      clearInterval(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
  }, []);

  const refreshDisplay = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      setDisplayRows([]);
      return;
    }
    setDisplayRows(
      displayPhotoDetections(
        session.detections,
        Date.now(),
        session.coords,
        session.observedAt,
        session.lastFrameKeys,
        LIVE_PHOTO_DETECTION_TTL_MS,
      ),
    );
  }, []);

  const captureAndIdentify = useCallback(async () => {
    if (
      !enabledRef.current ||
      !cameraActive ||
      pausedRef.current ||
      captureInFlightRef.current
    ) {
      return;
    }

    const camera = cameraRef.current;
    if (!camera) return;

    captureInFlightRef.current = true;
    setIsProcessing(true);
    setScanError(null);

    try {
      const photo = await camera.takePictureAsync({
        quality: 0.35,
        base64: false,
        shutterSound: false,
        skipProcessing: true,
      });

      if (!photo?.uri || !enabledRef.current || !sessionRef.current) return;

      const session = sessionRef.current;
      const coords = session.coords ?? (await refreshLocation());
      if (coords && !session.coords) {
        session.coords = coords;
      }

      const outcome = await identifyImageChunkSafe(photo.uri, {
        lat: session.coords?.latitude ?? null,
        lng: session.coords?.longitude ?? null,
        observedAt: session.observedAt,
      });

      if (!enabledRef.current || !sessionRef.current) return;

      if (outcome.ok) {
        const now = Date.now();
        sessionRef.current.detections = mergePhotoFramePredictions(
          sessionRef.current.detections,
          outcome.result,
          now,
        );
        sessionRef.current.lastFrameKeys = highlightKeysFromPhotoFrame(
          outcome.result,
        );
        refreshDisplay();
      } else if (__DEV__) {
        setScanError(outcome.reason);
      }
    } catch {
      // Frame capture can fail if the camera is busy — skip quietly.
    } finally {
      captureInFlightRef.current = false;
      setIsProcessing(false);

      if (enabledRef.current && !pausedRef.current) {
        clearScanTimer();
        scanTimerRef.current = setTimeout(() => {
          void captureAndIdentify();
        }, LIVE_PHOTO_INTERVAL_MS);
      }
    }
  }, [cameraActive, cameraRef, clearScanTimer, refreshDisplay, refreshLocation]);

  const stopScanning = useCallback(() => {
    clearScanTimer();
    clearPruneTimer();
    sessionRef.current = null;
    captureInFlightRef.current = false;
    setIsProcessing(false);
    setDisplayRows([]);
    setScanError(null);
  }, [clearPruneTimer, clearScanTimer]);

  const startScanning = useCallback(async () => {
    stopScanning();

    const coords = await refreshLocation();
    const now = new Date().toISOString();
    sessionRef.current = {
      detections: new Map(),
      coords,
      observedAt: now,
      lastFrameKeys: new Set(),
    };

    clearPruneTimer();
    pruneTimerRef.current = setInterval(() => {
      refreshDisplay();
    }, 500);

    void captureAndIdentify();
  }, [captureAndIdentify, clearPruneTimer, refreshDisplay, refreshLocation, stopScanning]);

  useEffect(() => {
    if (!enabled || !cameraActive) {
      stopScanning();
      return;
    }

    void startScanning();
    return () => {
      stopScanning();
    };
  }, [cameraActive, enabled, startScanning, stopScanning]);

  const primaryDetection =
    displayRows.find((row) => row.isInFrame && !row.isExpiring)?.detection ??
    displayRows.find((row) => !row.isExpiring)?.detection ??
    null;

  const spottedInFrame = displayRows.some(
    (row) => row.isInFrame && !row.isExpiring,
  );

  return {
    enabled,
    setEnabled,
    isScanning: enabled && cameraActive,
    isProcessing,
    displayRows,
    primaryDetection,
    spottedInFrame,
    scanError,
  };
}
