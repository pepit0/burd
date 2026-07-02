import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import type { CameraView } from "expo-camera";
import {
  capabilitiesFromLenses,
  clampZoomProp,
  defaultCapabilities,
  frontCameraCapabilities,
  labelFromZoomProp,
  magnificationFromZoomProp,
  type ZoomCapabilities,
} from "@/lib/cameraZoom";

interface UseCameraZoomOptions {
  facing: "front" | "back";
}

/** Pinch dampening — lower = slower zoom response. */
const PINCH_SENSITIVITY = 0.45;

interface PinchSession {
  active: boolean;
  startZoom: number;
  baselineScale: number;
}

export function useCameraZoom(
  cameraRef: RefObject<CameraView | null>,
  options: UseCameraZoomOptions,
) {
  const [capabilities, setCapabilities] = useState<ZoomCapabilities>(
    defaultCapabilities(),
  );
  /** expo-camera zoom prop (0 = widest, 1 = max digital). */
  const [zoom, setZoom] = useState(0);
  const [isPinching, setIsPinching] = useState(false);

  const zoomRef = useRef(0);
  zoomRef.current = zoom;

  const capsRef = useRef(capabilities);
  capsRef.current = capabilities;

  const pinchSession = useRef<PinchSession>({
    active: false,
    startZoom: 0,
    baselineScale: 1,
  });

  const zoomLabel = useMemo(
    () => labelFromZoomProp(zoom, capabilities),
    [capabilities, zoom],
  );

  const loadLenses = useCallback(async () => {
    try {
      const lenses = (await cameraRef.current?.getAvailableLensesAsync()) ?? [];
      const next =
        lenses.length > 0 ? capabilitiesFromLenses(lenses) : defaultCapabilities();
      setCapabilities(next);
    } catch {
      setCapabilities(defaultCapabilities());
    }
  }, [cameraRef]);

  const onCameraReady = useCallback(() => {
    void loadLenses();
  }, [loadLenses]);

  useEffect(() => {
    setZoom(0);
    zoomRef.current = 0;

    if (options.facing === "front") {
      setCapabilities(frontCameraCapabilities());
      return;
    }

    void loadLenses();
  }, [loadLenses, options.facing]);

  const endPinch = useCallback(() => {
    pinchSession.current.active = false;
    setIsPinching(false);
  }, []);

  const applyPinchScale = useCallback((scale: number) => {
    const session = pinchSession.current;

    if (!session.active) {
      session.active = true;
      session.startZoom = zoomRef.current;
      session.baselineScale = scale;
      setIsPinching(true);
      return;
    }

    const caps = capsRef.current;
    const relativeScale = scale / session.baselineScale;
    const startMag = magnificationFromZoomProp(session.startZoom, caps);
    const nextMag = startMag * Math.pow(relativeScale, PINCH_SENSITIVITY);
    const lo = caps.minLabel;
    const hi = caps.maxLabel;
    const clampedMag = Math.max(lo, Math.min(hi, nextMag));
    const span = Math.log(hi / lo);
    const nextZoom =
      span <= 0 ? 0 : Math.min(1, Math.log(clampedMag / lo) / span);

    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }, []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((event) => {
          runOnJS(applyPinchScale)(event.scale);
        })
        .onFinalize(() => {
          runOnJS(endPinch)();
        }),
    [applyPinchScale, endPinch],
  );

  return {
    zoom: clampZoomProp(zoom),
    zoomLabel,
    isPinching,
    onCameraReady,
    pinchGesture,
  };
}
