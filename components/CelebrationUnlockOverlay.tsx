import { useEffect, useId, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";
import type { LucideIcon } from "lucide-react-native";
import { SpeciesImage } from "@/components/SpeciesImage";

export const CELEBRATION_INTRO_MS = 1800;

const PRIMARY = "#5f9470";
const ACCENT = "#c8893a";
const CREAM = "#f0ead6";
const DISC = "#1f2a1c";
const HERO = Math.min(176, Math.round(Dimensions.get("window").width * 0.42));
const STAGE = HERO + 140;
const RAY_COUNT = 24;
const RING_R = HERO / 2;
const RAY_INNER = RING_R + 10;
const RAY_OUTER = RING_R + 46;

const SPARKLES = [
  { x: -102, y: -68, size: 11, delay: 0.08, star: true },
  { x: 96, y: -62, size: 8, delay: 0.12, star: true },
  { x: -84, y: 74, size: 9, delay: 0.16, star: true },
  { x: 90, y: 80, size: 10, delay: 0.1, star: true },
  { x: 4, y: -112, size: 7, delay: 0.18, star: true },
  { x: -70, y: -96, size: 6, delay: 0.14, star: true },
  { x: 72, y: -98, size: 5, delay: 0.2, star: true },
  { x: -114, y: 6, size: 8, delay: 0.11, star: true },
  { x: 116, y: 12, size: 6, delay: 0.19, star: true },
  { x: -48, y: 108, size: 7, delay: 0.13, star: true },
  { x: 42, y: 110, size: 5, delay: 0.17, star: true },
  { x: -108, y: 48, size: 4, delay: 0.15, star: false },
  { x: 108, y: 52, size: 3, delay: 0.21, star: false },
  { x: -56, y: -108, size: 3, delay: 0.09, star: false },
  { x: 58, y: -110, size: 4, delay: 0.22, star: false },
  { x: 0, y: 118, size: 3, delay: 0.14, star: false },
] as const;

function shiftedProgress(progress: number, delay: number): number {
  "worklet";
  if (progress <= delay) return 0;
  return Math.min(1, (progress - delay) / (1 - delay));
}

function SparkleMark({
  progress,
  config,
}: {
  progress: SharedValue<number>;
  config: (typeof SPARKLES)[number];
}) {
  const style = useAnimatedStyle(() => {
    const t = shiftedProgress(progress.value, config.delay);
    return {
      opacity: interpolate(t, [0, 0.25, 0.75, 1], [0, 1, 0.9, 0.75]),
      transform: [
        { translateX: config.x },
        { translateY: config.y },
        { scale: interpolate(t, [0, 0.35, 1], [0.2, 1.15, 1]) },
      ],
    };
  });

  const origin = {
    left: STAGE / 2 - config.size / 2,
    top: STAGE / 2 - config.size / 2,
  };

  if (config.star) {
    return (
      <Animated.Text
        style={[
          styles.star,
          origin,
          { fontSize: config.size, lineHeight: config.size + 2 },
          style,
        ]}
      >
        ✦
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={[
        styles.sparkleDot,
        origin,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
        },
        style,
      ]}
    />
  );
}

function HeroAura({ gradientId }: { gradientId: string }) {
  const cx = STAGE / 2;
  const cy = STAGE / 2;
  const rays = useMemo(
    () =>
      Array.from({ length: RAY_COUNT }, (_, index) => {
        const angle = ((Math.PI * 2) / RAY_COUNT) * index - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
          x1: cx + cos * RAY_INNER,
          y1: cy + sin * RAY_INNER,
          x2: cx + cos * RAY_OUTER,
          y2: cy + sin * RAY_OUTER,
        };
      }),
    [],
  );

  return (
    <Svg width={STAGE} height={STAGE} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.38" />
          <Stop offset="42%" stopColor={ACCENT} stopOpacity="0.16" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={STAGE / 2} fill={`url(#${gradientId})`} />
      {rays.map((ray, index) => (
        <Line
          key={`ray-${index}`}
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          stroke={ACCENT}
          strokeOpacity={0.34}
          strokeWidth={1}
        />
      ))}
    </Svg>
  );
}

export interface CelebrationIconStyle {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  iconFill: string;
}

export interface CelebrationPhoto {
  catalogId?: string | null;
  scientificName: string;
}

export interface CelebrationUnlockOverlayProps {
  unlockKey: number;
  visible: boolean;
  kicker: string;
  title: string;
  subtitle?: string;
  description?: string;
  pill?: string;
  icon?: LucideIcon;
  iconStyle?: CelebrationIconStyle;
  photo?: CelebrationPhoto | null;
  canDismiss: boolean;
  dismissLabel?: string;
  onIntroComplete: () => void;
  onDismiss: () => void;
}

export function CelebrationUnlockOverlay({
  unlockKey,
  visible,
  kicker,
  title,
  subtitle,
  description,
  pill,
  icon: Icon,
  iconStyle,
  photo,
  canDismiss,
  dismissLabel = "Continue",
  onIntroComplete,
  onDismiss,
}: CelebrationUnlockOverlayProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);
  const sparkles = useMemo(() => SPARKLES, []);
  const gradientId = `celebration-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const italicLine = subtitle?.trim() || description?.trim() || "";

  const finishIntro = () => {
    onIntroComplete();
  };

  useEffect(() => {
    if (unlockKey <= 0 || !visible) return;
    setActive(true);
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: CELEBRATION_INTRO_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishIntro)();
      },
    );
  }, [unlockKey, visible, progress]);

  useEffect(() => {
    if (!visible) setActive(false);
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 1], [0, 1, 1]),
  }));

  const clusterStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.12, 1], [0, 1, 1]),
      transform: [
        { translateY: interpolate(t, [0, 0.25, 1], [28, -4, 0]) },
        { scale: interpolate(t, [0, 0.22, 0.4], [0.92, 1.03, 1]) },
      ],
    };
  });

  const heroStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      transform: [
        { scale: interpolate(t, [0, 0.2, 0.38, 0.55], [0.72, 1.08, 0.98, 1]) },
      ],
    };
  });

  if (!active || !visible) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents={canDismiss ? "auto" : "box-none"}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        disabled={!canDismiss}
        onPress={canDismiss ? onDismiss : undefined}
        accessibilityRole="button"
        accessibilityLabel={canDismiss ? "Dismiss celebration" : undefined}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <View
        style={[
          styles.centerWrap,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.cluster, clusterStyle]} pointerEvents="box-none">
          <Text style={styles.kicker}>{kicker}</Text>

          <Animated.View style={[styles.heroStage, heroStyle]}>
            <HeroAura gradientId={gradientId} />
            {sparkles.map((config, index) => (
              <SparkleMark key={`sparkle-${index}`} progress={progress} config={config} />
            ))}
            <View style={styles.halo} />
            <View style={styles.heroRing}>
              {photo ? (
                <SpeciesImage
                  catalogId={photo.catalogId}
                  scientificName={photo.scientificName}
                  size="large"
                  style={styles.heroPhoto}
                />
              ) : Icon && iconStyle ? (
                <View style={styles.heroIconFill}>
                  <Icon
                    size={64}
                    color={iconStyle.iconColor}
                    fill={iconStyle.iconFill}
                    strokeWidth={1.75}
                  />
                </View>
              ) : null}
            </View>
          </Animated.View>

          <Text style={styles.title}>{title}</Text>
          {italicLine ? <Text style={styles.subtitle}>{italicLine}</Text> : null}
          {pill ? (
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>{pill}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onDismiss}
            disabled={!canDismiss}
            style={styles.continueButton}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            accessibilityState={{ disabled: !canDismiss }}
          >
            <Text style={styles.continueLabel}>{dismissLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

export function nextCelebrationUnlockKey(key: number): number {
  return key + 1;
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0f08",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  cluster: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  kicker: {
    marginBottom: 22,
    textAlign: "center",
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: ACCENT,
  },
  heroStage: {
    width: STAGE,
    height: STAGE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  halo: {
    position: "absolute",
    width: HERO + 16,
    height: HERO + 16,
    borderRadius: (HERO + 16) / 2,
    borderWidth: 6,
    borderColor: "rgba(200, 137, 58, 0.28)",
  },
  star: {
    position: "absolute",
    color: ACCENT,
    textAlign: "center",
  },
  sparkleDot: {
    position: "absolute",
    backgroundColor: CREAM,
  },
  heroRing: {
    width: HERO,
    height: HERO,
    borderRadius: HERO / 2,
    borderWidth: 3,
    borderColor: ACCENT,
    overflow: "hidden",
    backgroundColor: DISC,
  },
  heroPhoto: {
    width: "100%",
    height: "100%",
  },
  heroIconFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DISC,
  },
  title: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: "Lora_600SemiBold",
    fontSize: 28,
    lineHeight: 34,
    color: CREAM,
  },
  subtitle: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: "Lora_400Regular_Italic",
    fontSize: 15,
    lineHeight: 20,
    color: PRIMARY,
  },
  pill: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: CREAM,
  },
  continueButton: {
    marginTop: 22,
    width: "100%",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
  },
  continueLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: CREAM,
  },
});
