import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const TIPS = [
  "Point your phone toward the trees and tap listen",
  "Dawn chorus is prime time for live IDs",
  "Hold still — sudden movement scares birds away",
  "Try again after a bird pauses between songs",
  "Works best outdoors with minimal wind noise",
];

interface LiveSoundTipCarouselProps {
  active: boolean;
  inline?: boolean;
}

export function LiveSoundTipCarousel({ active, inline = false }: LiveSoundTipCarouselProps) {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % TIPS.length);
    opacity.value = withTiming(1, { duration: 320 });
  }, [opacity]);

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      opacity.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(advance)();
      });
    }, 4200);

    return () => clearInterval(timer);
  }, [active, advance, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!active) return null;

  const tipText = (
    <Animated.Text
      style={style}
      numberOfLines={inline ? 2 : undefined}
      className={
        inline
          ? "text-right font-sans text-xs leading-relaxed text-muted-foreground"
          : "px-6 py-2 text-center font-sans text-sm leading-relaxed text-muted-foreground"
      }
    >
      {TIPS[index]}
    </Animated.Text>
  );

  if (inline) {
    return <View className="min-w-0 flex-1 shrink">{tipText}</View>;
  }

  return tipText;
}
