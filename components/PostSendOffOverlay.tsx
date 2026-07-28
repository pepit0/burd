import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Send } from "lucide-react-native";

const DURATION_MS = 1450;
const PRIMARY = "#5f9470";
const ACCENT = "#c8893a";
const CREAM = "#f0ead6";

/** Particles arc upward and outward — a “sent into the world” trail. */
const TRAILS = Array.from({ length: 10 }, (_, i) => ({
  angle: -Math.PI / 2 + ((i - 4.5) / 4.5) * 0.85,
  distance: 72 + (i % 4) * 28,
  size: 10 + (i % 3) * 4,
  delay: 0.08 + i * 0.04,
}));

const SPARKLES = Array.from({ length: 16 }, (_, i) => ({
  offsetX: ((i * 23) % 120) - 60,
  startY: 20 + (i % 5) * 8,
  size: 2 + (i % 3) * 1.5,
  color: [PRIMARY, ACCENT, CREAM, "#8a9e82"][i % 4],
  lift: -90 - (i % 6) * 22,
  delay: 0.1 + (i % 5) * 0.035,
}));

function shiftedProgress(progress: number, delay: number): number {
  "worklet";
  if (progress <= delay) return 0;
  return Math.min(1, (progress - delay) / (1 - delay));
}

function RippleRing({
  progress,
  delay,
  maxScale,
  driftY,
}: {
  progress: SharedValue<number>;
  delay: number;
  maxScale: number;
  driftY: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, delay);
    return {
      opacity: interpolate(t, [0, 0.18, 0.7, 1], [0, 0.5, 0.22, 0]),
      transform: [
        { scale: interpolate(t, [0, 1], [0.3, maxScale]) },
        { translateY: driftY * t },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { borderColor: PRIMARY }, style]}
    />
  );
}

function TrailDot({
  progress,
  config,
}: {
  progress: SharedValue<number>;
  config: (typeof TRAILS)[number];
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, config.delay);
    const x = Math.cos(config.angle) * config.distance * t;
    const y = Math.sin(config.angle) * config.distance * t;
    return {
      opacity: interpolate(t, [0, 0.12, 0.5, 1], [0, 0.95, 0.7, 0]),
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: interpolate(t, [0, 0.2, 0.65, 1], [0.2, 1, 0.7, 0.25]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.trailDot,
        { width: config.size, height: config.size, borderRadius: config.size / 2 },
        style,
      ]}
    />
  );
}

function SparkleDot({
  progress,
  config,
}: {
  progress: SharedValue<number>;
  config: (typeof SPARKLES)[number];
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, config.delay);
    return {
      opacity: interpolate(t, [0, 0.15, 0.55, 1], [0, 1, 0.65, 0]),
      transform: [
        { translateX: config.offsetX * interpolate(t, [0, 1], [0.15, 1]) },
        { translateY: config.startY + config.lift * t },
        { scale: interpolate(t, [0, 0.3, 1], [0, 1.15, 0.35]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
        },
        style,
      ]}
    />
  );
}

interface PostSendOffOverlayProps {
  /** Increment to replay the animation. */
  sendOffKey: number;
  onComplete?: () => void;
  heroSize?: number;
}

/** Full-screen “sent to your profile” celebration when a sighting is published. */
export function PostSendOffOverlay({
  sendOffKey,
  onComplete,
  heroSize = 76,
}: PostSendOffOverlayProps) {
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);

  const finish = () => {
    setActive(false);
    onComplete?.();
  };

  useEffect(() => {
    if (sendOffKey <= 0) return;
    setActive(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finish)();
      },
    );
  }, [sendOffKey, progress]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.07, 0.24], [0, 0.22, 0]),
  }));

  const heroStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.1, 0.38, 0.62, 1], [0, 1, 1, 0.75, 0]),
      transform: [
        { scale: interpolate(t, [0, 0.12, 0.28, 0.45], [0.4, 1.35, 1.05, 0.85]) },
        { translateY: interpolate(t, [0, 0.35, 1], [0, -8, -132]) },
        { rotate: `${interpolate(t, [0, 0.2, 0.5], [12, -6, -28])}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.5, 0.85], [0, 0.8, 0.4, 0]),
    transform: [
      {
        scale: interpolate(progress.value, [0, 0.22, 0.55, 1], [0.35, 1.2, 1.55, 1.9]),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [0, -48]),
      },
    ],
  }));

  const trails = useMemo(() => TRAILS, []);
  const sparkles = useMemo(() => SPARKLES, []);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.flash, flashStyle]} />

      <View style={styles.centerStage}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <RippleRing progress={progress} delay={0.05} maxScale={2.2} driftY={-18} />
        <RippleRing progress={progress} delay={0.16} maxScale={2.85} driftY={-36} />

        {sparkles.map((config, index) => (
          <SparkleDot key={`sparkle-${index}`} progress={progress} config={config} />
        ))}

        {trails.map((config, index) => (
          <TrailDot key={`trail-${index}`} progress={progress} config={config} />
        ))}

        <Animated.View style={[styles.hero, heroStyle]}>
          <View style={styles.heroShadow}>
            <Send size={heroSize} color={CREAM} strokeWidth={2.2} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** Bump to fire a new post send-off burst. */
export function nextSendOffKey(key: number): number {
  return key + 1;
}

export const POST_SEND_OFF_DURATION_MS = DURATION_MS;

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(95, 148, 112, 0.28)",
  },
  centerStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(95, 148, 112, 0.42)",
  },
  ring: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2.5,
  },
  trailDot: {
    position: "absolute",
    backgroundColor: PRIMARY,
  },
  sparkle: {
    position: "absolute",
  },
  hero: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  heroShadow: {
    shadowColor: PRIMARY,
    shadowOpacity: 0.95,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
});
