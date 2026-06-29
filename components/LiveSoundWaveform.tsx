import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

const BAR_COUNT = 16;
const BAR_MAX_HEIGHT = 88;

interface LiveSoundWaveformProps {
  active: boolean;
  level: number;
}

function WaveBar({
  active,
  level,
  index,
}: {
  active: boolean;
  level: number;
  index: number;
}) {
  const height = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const jitter = 0.35 + ((index * 7) % 11) / 20;
    const target = active
      ? Math.max(12, Math.min(BAR_MAX_HEIGHT, level * jitter * BAR_MAX_HEIGHT + 16))
      : 12;
    Animated.timing(height, {
      toValue: target,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [active, height, index, level]);

  const opacity = active
    ? height.interpolate({
        inputRange: [12, BAR_MAX_HEIGHT],
        outputRange: [0.55, 1],
        extrapolate: "clamp",
      })
    : 0.25;

  return (
    <Animated.View
      style={{
        width: "100%",
        height,
        opacity,
        borderRadius: 999,
        backgroundColor: "#5f9470",
      }}
    />
  );
}

export function LiveSoundWaveform({ active, level }: LiveSoundWaveformProps) {
  return (
    <View className="h-28 w-full flex-row items-end justify-center gap-1.5 px-6">
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <View key={index} className="h-full flex-1 items-center justify-end">
          <WaveBar active={active} level={level} index={index} />
        </View>
      ))}
    </View>
  );
}
