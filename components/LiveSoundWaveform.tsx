import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BAR_COUNT = 16;
const BAR_MAX_HEIGHT = 88;

interface LiveSoundWaveformProps {
  active: boolean;
  level: number;
  /** Gentle breathing wave when not actively listening. */
  idleAnimate?: boolean;
  compact?: boolean;
}

function WaveBar({
  active,
  level,
  index,
  idleAnimate,
  barMaxHeight,
  barMinHeight,
}: {
  active: boolean;
  level: number;
  index: number;
  idleAnimate: boolean;
  barMaxHeight: number;
  barMinHeight: number;
}) {
  const height = useSharedValue(barMinHeight);

  useEffect(() => {
    if (active) {
      const jitter = 0.35 + ((index * 7) % 11) / 20;
      const target = Math.max(
        barMinHeight,
        Math.min(barMaxHeight, level * jitter * barMaxHeight + barMinHeight + 4),
      );
      height.value = withTiming(target, { duration: 16 });
      return;
    }

    if (!idleAnimate) {
      height.value = withTiming(barMinHeight, { duration: 200 });
      return;
    }

    height.value = withRepeat(
      withTiming(barMaxHeight * (0.18 + ((index % 5) + 1) * 0.06), {
        duration: 900 + (index % 4) * 120,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [active, barMaxHeight, barMinHeight, height, idleAnimate, index, level]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: active ? 0.55 + (height.value / barMaxHeight) * 0.45 : 0.35,
  }));

  return (
    <Animated.View
      style={[
        {
          width: "100%",
          borderRadius: 999,
          backgroundColor: active ? "#c8893a" : "#5f9470",
        },
        barStyle,
      ]}
    />
  );
}

export function LiveSoundWaveform({
  active,
  level,
  idleAnimate = false,
  compact = false,
}: LiveSoundWaveformProps) {
  const barCount = compact ? 18 : BAR_COUNT;
  const barMaxHeight = compact ? 44 : BAR_MAX_HEIGHT;
  const barMinHeight = compact ? 6 : 12;

  return (
    <View
      className={`w-full flex-row items-end justify-center ${
        compact ? "h-14 gap-0.5 px-1" : "h-28 gap-1.5 px-6"
      }`}
    >
      {Array.from({ length: barCount }, (_, index) => (
        <View key={index} className="h-full flex-1 items-center justify-end">
          <WaveBar
            active={active}
            level={level}
            index={index}
            idleAnimate={idleAnimate && !active}
            barMaxHeight={barMaxHeight}
            barMinHeight={barMinHeight}
          />
        </View>
      ))}
    </View>
  );
}
