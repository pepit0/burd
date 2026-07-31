import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { useColorTheme } from "@/components/ColorThemeProvider";

export const CELEBRATION_INTRO_MS = 1800;

const PRIMARY = "#5f9470";
const ACCENT = "#c8893a";
const CREAM = "#f0ead6";

const SPARKLES = Array.from({ length: 10 }, (_, i) => ({
  offsetX: ((i * 19) % 80) - 40,
  offsetY: ((i * 11) % 40) - 20,
  size: 3 + (i % 2) * 2,
  color: [PRIMARY, ACCENT, CREAM, "#8a9e82"][i % 4],
  delay: 0.08 + (i % 4) * 0.06,
}));

function shiftedProgress(progress: number, delay: number): number {
  "worklet";
  if (progress <= delay) return 0;
  return Math.min(1, (progress - delay) / (1 - delay));
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
      opacity: interpolate(t, [0, 0.2, 0.7, 1], [0, 1, 0.6, 0]),
      transform: [
        { translateX: config.offsetX * t },
        { translateY: config.offsetY * t - 18 * t },
        { scale: interpolate(t, [0, 0.35, 1], [0.2, 1.1, 0.4]) },
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

export interface CelebrationIconStyle {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  iconFill: string;
}

export interface CelebrationUnlockOverlayProps {
  unlockKey: number;
  visible: boolean;
  kicker: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconStyle: CelebrationIconStyle;
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
  description,
  icon: Icon,
  iconStyle,
  canDismiss,
  dismissLabel = "Continue",
  onIntroComplete,
  onDismiss,
}: CelebrationUnlockOverlayProps) {
  const { palette } = useColorTheme();
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);
  const sparkles = useMemo(() => SPARKLES, []);

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
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.45, 0.5]),
  }));

  const cardStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: interpolate(t, [0, 0.12, 0.35, 1], [0, 1, 1, 1]),
      transform: [
        { translateY: interpolate(t, [0, 0.25, 1], [36, -4, 0]) },
        { scale: interpolate(t, [0, 0.22, 0.4], [0.88, 1.04, 1]) },
      ],
    };
  });

  const heroIconStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      transform: [
        { scale: interpolate(t, [0, 0.18, 0.32, 0.5], [0.3, 1.18, 1, 1]) },
        { rotate: `${interpolate(t, [0, 0.25, 0.45], [-14, 8, 0])}deg` },
      ],
    };
  });

  if (!active || !visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents={canDismiss ? "auto" : "box-none"}>
      <Pressable
        style={StyleSheet.absoluteFill}
        disabled={!canDismiss}
        onPress={canDismiss ? onDismiss : undefined}
        accessibilityRole="button"
        accessibilityLabel={canDismiss ? "Dismiss celebration" : undefined}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              shadowColor: palette.primary,
            },
            cardStyle,
          ]}
        >
          <View style={styles.sparkleStage}>
            {sparkles.map((config, index) => (
              <SparkleDot key={`sparkle-${index}`} progress={progress} config={config} />
            ))}
          </View>

          <Text style={[styles.kicker, { color: palette.accent }]}>{kicker}</Text>

          <Animated.View
            style={[
              styles.iconWrap,
              {
                backgroundColor: iconStyle.backgroundColor,
                borderColor: iconStyle.borderColor,
              },
              heroIconStyle,
            ]}
          >
            <Icon
              size={34}
              color={iconStyle.iconColor}
              fill={iconStyle.iconFill}
              strokeWidth={2}
            />
          </Animated.View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.buttonSlot}>
            <Pressable
              onPress={onDismiss}
              disabled={!canDismiss}
              style={[
                styles.continueButton,
                { backgroundColor: palette.primary },
                !canDismiss && styles.continueButtonHidden,
              ]}
              accessibilityRole="button"
              accessibilityLabel={dismissLabel}
              accessibilityState={{ disabled: !canDismiss }}
            >
              <Text style={[styles.continueLabel, { color: palette.primaryForeground }]}>
                {dismissLabel}
              </Text>
            </Pressable>
          </View>
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
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  kicker: {
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
    color: "#ffffff",
  },
  description: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.88)",
  },
  buttonSlot: {
    marginTop: 20,
    width: "100%",
    minHeight: 46,
    justifyContent: "center",
  },
  continueButton: {
    width: "100%",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonHidden: {
    opacity: 0,
  },
  continueLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
  },
  sparkleStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkle: {
    position: "absolute",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
