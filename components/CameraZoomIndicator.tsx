import { Text, View } from "react-native";

interface CameraZoomIndicatorProps {
  zoomLabel: string;
  visible: boolean;
}

/** Live zoom readout while pinching — no preset buttons. */
export function CameraZoomIndicator({
  zoomLabel,
  visible,
}: CameraZoomIndicatorProps) {
  if (!visible) return null;

  return (
    <View className="mb-3 items-center">
      <View className="min-h-[30px] items-center justify-center rounded-full bg-black/55 px-4 py-1.5">
        <Text className="font-mono text-sm font-medium text-accent">
          {zoomLabel}
        </Text>
      </View>
    </View>
  );
}
