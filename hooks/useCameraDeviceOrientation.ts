import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

/** Degrees to rotate camera chrome in place while the screen stays portrait-locked. */
export type CameraUiRotation = 0 | 90 | -90;

const GRAVITY_THRESHOLD = 0.62;

function rotationFromGravity(x: number, y: number): CameraUiRotation {
  // iOS and Android report opposite signs for the same physical tilt.
  const orientedX = Platform.OS === "android" ? -x : x;
  const absX = Math.abs(orientedX);
  const absY = Math.abs(y);

  if (absX < GRAVITY_THRESHOLD && absY < GRAVITY_THRESHOLD) {
    return 0;
  }

  if (absX > absY) {
    // Landscape left (phone rotated CCW): spin controls +90° so labels face the user.
    if (orientedX <= -GRAVITY_THRESHOLD) return 90;
    if (orientedX >= GRAVITY_THRESHOLD) return -90;
  }

  return 0;
}

/**
 * Tracks physical device tilt while the UI layout stays portrait-fixed.
 * Controls rotate in place via {@link CameraOriented} — nothing moves on screen.
 */
export function useCameraDeviceOrientation(): CameraUiRotation {
  const [rotation, setRotation] = useState<CameraUiRotation>(0);

  useEffect(() => {
    if (Platform.OS === "web") return;

    Accelerometer.setUpdateInterval(160);
    const subscription = Accelerometer.addListener(({ x, y }) => {
      setRotation((current) => {
        const next = rotationFromGravity(x, y);
        return next === current ? current : next;
      });
    });

    return () => subscription.remove();
  }, []);

  return rotation;
}
