import { Text, View } from "react-native";
import { CameraOriented } from "@/components/CameraOriented";
import type { CameraUiRotation } from "@/hooks/useCameraDeviceOrientation";

interface CameraZoomIndicatorProps {
  zoomLabel: string;
  visible: boolean;
  uiRotation?: CameraUiRotation;
}

/** Live zoom readout while pinching — no preset buttons. */
export function CameraZoomIndicator({
  zoomLabel,
  visible,
  uiRotation = 0,
}: CameraZoomIndicatorProps) {
  if (!visible) return null;

  return (
    <CameraOriented rotation={uiRotation} align="center" style={{ marginBottom: 12 }}>
      <View className="min-h-[30px] items-center justify-center rounded-full bg-black/55 px-4 py-1.5">
        <Text className="font-mono text-sm font-medium text-accent">
          {zoomLabel}
        </Text>
      </View>
    </CameraOriented>
  );
}
