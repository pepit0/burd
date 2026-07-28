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
import { LikeIcon } from "@/components/LikeIcon";
import { LIKED_ICON_COLOR, type LikeIconStyle } from "@/lib/likeIconStyle";

const DURATION_MS = 1200;

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  angle: (i / 8) * Math.PI * 2 + 0.4,
  distance: 58 + (i % 3) * 26,
  size: 15 + (i % 3) * 5,
  spin: (i % 2 === 0 ? 1 : -1) * (18 + i * 7),
  delay: 0.06 + i * 0.035,
}));

const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  offsetX: ((i * 29) % 140) - 70,
  offsetY: ((i * 41) % 90) - 45,
  size: 2.5 + (i % 4) * 1.5,
  color: ["#f87171", "#c8893a", "#5f9470", "#f0ead6", "#8a9e82"][i % 5],
  drift: -48 - (i % 5) * 16,
  delay: 0.12 + (i % 6) * 0.04,
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
}: {
  progress: SharedValue<number>;
  delay: number;
  maxScale: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, delay);
    return {
      opacity: interpolate(t, [0, 0.2, 0.75, 1], [0, 0.55, 0.2, 0]),
      transform: [{ scale: interpolate(t, [0, 1], [0.35, maxScale]) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { borderColor: LIKED_ICON_COLOR },
        style,
      ]}
    />
  );
}

function BurstParticle({
  progress,
  iconStyle,
  config,
}: {
  progress: SharedValue<number>;
  iconStyle: LikeIconStyle;
  config: (typeof PARTICLES)[number];
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, config.delay);
    const x = Math.cos(config.angle) * config.distance * t;
    const y = Math.sin(config.angle) * config.distance * t;
    return {
      opacity: interpolate(t, [0, 0.15, 0.55, 1], [0, 1, 0.85, 0]),
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: interpolate(t, [0, 0.25, 0.7, 1], [0.25, 1.05, 0.75, 0.35]) },
        { rotate: `${config.spin * t}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]}>
      <LikeIcon liked style={iconStyle} size={config.size} />
    </Animated.View>
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
      opacity: interpolate(t, [0, 0.2, 0.65, 1], [0, 1, 0.7, 0]),
      transform: [
        { translateX: config.offsetX * interpolate(t, [0, 1], [0.2, 1]) },
        {
          translateY:
            config.offsetY * 0.3 + config.drift * t,
        },
        { scale: interpolate(t, [0, 0.35, 1], [0, 1.2, 0.4]) },
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

interface LikeBurstOverlayProps {
  /** Increment to replay the animation. */
  burstKey: number;
  iconStyle: LikeIconStyle;
  /** Hero icon size at the center of the burst. */
  heroSize?: number;
}

/** Full-screen overlay burst when a post is liked. */
export function LikeBurstOverlay({
  burstKey,
  iconStyle,
  heroSize = 72,
}: LikeBurstOverlayProps) {
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);

  const finish = () => setActive(false);

  useEffect(() => {
    if (burstKey <= 0) return;
    setActive(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finish)();
      },
    );
  }, [burstKey, progress]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.06, 0.22], [0, 0.28, 0]),
  }));

  const heroStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.08, 0.42, 0.72, 1], [0, 1, 1, 0.55, 0]),
      transform: [
        { scale: interpolate(t, [0, 0.14, 0.32, 0.5, 0.72, 1], [0, 1.45, 0.92, 1.08, 0.95, 0.55]) },
        { rotate: `${interpolate(t, [0, 0.18, 0.38], [-14, 10, 0])}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.45, 0.8], [0, 0.75, 0.35, 0]),
    transform: [
      {
        scale: interpolate(progress.value, [0, 0.2, 0.55], [0.4, 1.35, 1.8]),
      },
    ],
  }));

  const particles = useMemo(() => PARTICLES, []);
  const sparkles = useMemo(() => SPARKLES, []);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.flash, flashStyle]} />

      <View style={styles.centerStage}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <RippleRing progress={progress} delay={0.04} maxScale={2.4} />
        <RippleRing progress={progress} delay={0.14} maxScale={2.9} />

        {sparkles.map((config, index) => (
          <SparkleDot key={`sparkle-${index}`} progress={progress} config={config} />
        ))}

        {particles.map((config, index) => (
          <BurstParticle
            key={`particle-${index}`}
            progress={progress}
            iconStyle={iconStyle}
            config={config}
          />
        ))}

        <Animated.View style={[styles.hero, heroStyle]}>
          <View style={styles.heroShadow}>
            <LikeIcon liked style={iconStyle} size={heroSize} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(240, 234, 214, 0.35)",
  },
  centerStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(248, 113, 113, 0.35)",
  },
  ring: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
  },
  particle: {
    position: "absolute",
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
    shadowColor: "#f87171",
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});

/** Bump to fire a new like burst. */
export function nextLikeBurstKey(key: number): number {
  return key + 1;
}
