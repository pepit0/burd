import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import type { CameraUiRotation } from "@/hooks/useCameraDeviceOrientation";

type CameraOrientedAlign = "start" | "center" | "end";

interface CameraOrientedProps {
  rotation: CameraUiRotation;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Keeps the rotation pivot on the control itself, not a wide parent row. */
  align?: CameraOrientedAlign;
}

const ALIGN_SELF: Record<CameraOrientedAlign, ViewStyle["alignSelf"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/** Rotates a single control in place; wrap one button per instance. */
export function CameraOriented({
  rotation,
  children,
  style,
  align = "start",
}: CameraOrientedProps) {
  const rotateAnim = useRef(new Animated.Value(rotation)).current;

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: rotation,
      useNativeDriver: true,
      friction: 14,
      tension: 140,
    }).start();
  }, [rotation, rotateAnim]);

  return (
    <Animated.View
      style={[
        { alignSelf: ALIGN_SELF[align] },
        style,
        {
          transform: [
            {
              rotate: rotateAnim.interpolate({
                inputRange: [-90, 0, 90],
                outputRange: ["-90deg", "0deg", "90deg"],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
