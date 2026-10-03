import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTourPhotoIdMock } from "@/components/AppTourPhotoIdMock";
import { BurdLogoMark } from "@/components/BurdLogoMark";
import {
  APP_TOUR_STEPS,
  type AppTourPhase,
  type AppTourTargetRect,
} from "@/lib/appTourSteps";

export type { AppTourPhase };

const PRIMARY = "#5f9470";
const ACCENT = "#c8893a";
const CREAM = "#f0ead6";
const SCRIM = "#0a0f08";
/** Dimmed backdrop — lighter so the app stays visible behind the tour. */
const SCRIM_OPACITY = 0.8;
const FULL_SCRIM_OPACITY = 0.84;
const HOLE_PAD = 6;

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${y + height - r}`,
    `A${r},${r} 0 0 1 ${x + width - r},${y + height}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + height - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y} Z`,
  ].join(" ");
}

function ContinueButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.continueButton}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.continueLabel}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.backButton}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.backLabel}>Back</Text>
    </Pressable>
  );
}

interface AppTourOverlayProps {
  phase: AppTourPhase;
  stepIndex: number;
  targetRect: AppTourTargetRect | null;
  onWelcomeContinue: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function AppTourOverlay({
  phase,
  stepIndex,
  targetRect,
  onWelcomeContinue,
  onNext,
  onBack,
}: AppTourOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  if (phase !== "welcome" && phase !== "tour") return null;

  const step = APP_TOUR_STEPS[stepIndex];
  const total = APP_TOUR_STEPS.length;
  const photoIdStep = phase === "tour" && step?.kind === "photo-id";
  const hole = targetRect
    ? {
        x: Math.max(0, targetRect.x - origin.x - HOLE_PAD),
        y: Math.max(0, targetRect.y - origin.y - HOLE_PAD),
        width: targetRect.width + HOLE_PAD * 2,
        height: targetRect.height + HOLE_PAD * 2,
      }
    : null;
  const circular =
    hole != null && Math.abs(hole.width - hole.height) < 12;
  const holeRadius = hole
    ? circular
      ? Math.min(hole.width, hole.height) / 2
      : Math.min(18, hole.width / 2, hole.height / 2)
    : 0;

  return (
    <View
      ref={overlayRef}
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents="auto"
      accessibilityViewIsModal
      onLayout={() => {
        overlayRef.current?.measureInWindow((x, y) => {
          setOrigin((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
        });
      }}
    >
      {photoIdStep ? (
        <AppTourPhotoIdMock onComplete={onNext} onBack={onBack} />
      ) : null}

      {!photoIdStep && phase === "tour" && hole && hole.width > 0 ? (
        <Svg width={windowWidth} height={windowHeight} style={StyleSheet.absoluteFill}>
          <Path
            d={`M0,0 H${windowWidth} V${windowHeight} H0 Z ${
              circular
                ? `M${hole.x + hole.width / 2},${hole.y + hole.height / 2} m-${holeRadius},0 a${holeRadius},${holeRadius} 0 1 0 ${holeRadius * 2},0 a${holeRadius},${holeRadius} 0 1 0 -${holeRadius * 2},0`
                : roundedRectPath(hole.x, hole.y, hole.width, hole.height, holeRadius)
            }`}
            fill={SCRIM}
            fillOpacity={SCRIM_OPACITY}
            fillRule="evenodd"
            clipRule="evenodd"
          />
          {circular ? (
            <Circle
              cx={hole.x + hole.width / 2}
              cy={hole.y + hole.height / 2}
              r={holeRadius}
              stroke={ACCENT}
              strokeWidth={2.5}
              fill="none"
            />
          ) : (
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={holeRadius}
              stroke={ACCENT}
              strokeWidth={2}
              fill="none"
            />
          )}
        </Svg>
      ) : photoIdStep ? null : (
        <View style={styles.fullScrim} />
      )}

      {phase === "welcome" ? (
        <View
          style={[
            styles.centerWrap,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={styles.cluster}>
            <BurdLogoMark size={52} />
            <Text style={styles.kicker}>Get started</Text>
            <Text style={styles.heroTitle}>Welcome to Burd</Text>
            <Text style={styles.heroBody}>
              Identify birds by photo or sound, then save them to your journal.
            </Text>
            <ContinueButton label="Continue" onPress={onWelcomeContinue} />
          </View>
        </View>
      ) : null}

      {phase === "tour" && step && !photoIdStep ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.centerWrap,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
            },
            step.copyAlign === "bottom" && {
              justifyContent: "flex-end",
              paddingBottom: insets.bottom + 120,
            },
          ]}
        >
          <View style={styles.cluster}>
            <Text style={[styles.kicker, styles.stepKicker]}>
              {step.kicker} · {stepIndex + 1} of {total}
            </Text>
            <Text style={styles.heroTitle}>{step.title}</Text>
            <Text style={styles.heroBody}>{step.body}</Text>
            <ContinueButton
              label={stepIndex >= total - 1 ? "Done" : "Continue"}
              onPress={onNext}
            />
            <BackButton onPress={onBack} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1400,
    elevation: 1400,
  },
  fullScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `rgba(10, 15, 8, ${FULL_SCRIM_OPACITY})`,
  },
  centerWrap: {
    ...StyleSheet.absoluteFill,
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
    marginTop: 22,
    marginBottom: 10,
    textAlign: "center",
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: ACCENT,
  },
  stepKicker: {
    marginTop: 0,
  },
  heroTitle: {
    textAlign: "center",
    fontFamily: "Lora_600SemiBold",
    fontSize: 28,
    lineHeight: 34,
    color: CREAM,
  },
  heroBody: {
    marginTop: 8,
    marginBottom: 22,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: PRIMARY,
  },
  continueButton: {
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
  backButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: CREAM,
    opacity: 0.72,
    textAlign: "center",
  },
});
