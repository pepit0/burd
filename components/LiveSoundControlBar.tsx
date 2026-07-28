import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Mic, Square } from "lucide-react-native";
import type { LiveSoundStatus } from "@/hooks/useLiveSoundId";

const RECORD_SIZE = 112;
const RECORD_RADIUS = RECORD_SIZE / 2;

interface LiveSoundControlBarProps {
  status: LiveSoundStatus;
  recording: boolean;
  processing: boolean;
  saving: boolean;
  disabled: boolean;
  statusLabel: string;
  helperText?: string | null;
  onPress: () => void;
}

export function LiveSoundControlBar({
  status,
  recording,
  processing,
  saving,
  disabled,
  statusLabel,
  helperText,
  onPress,
}: LiveSoundControlBarProps) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const glowVisible = useSharedValue(1);
  const buttonLocked = disabled || saving || processing;

  useEffect(() => {
    const shouldAnimate = !recording && !saving && !processing && !disabled;

    if (!shouldAnimate) {
      cancelAnimation(pulse);
      cancelAnimation(glow);
      pulse.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
      glowVisible.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
      return;
    }

    glowVisible.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });

    cancelAnimation(pulse);
    pulse.value = withRepeat(
      withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    cancelAnimation(glow);
    glow.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [disabled, glow, glowVisible, processing, pulse, recording, saving]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowVisible.value * 0.22 * glow.value,
    transform: [{ scale: 1 + glow.value * 0.14 }],
  }));

  const showSpinner = saving || processing;
  const showStop = recording && !showSpinner;

  return (
    <View style={styles.content}>
      <View style={styles.topSection}>
        <View style={styles.recordWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.recordGlow, glowStyle]}
          />
          <Animated.View style={buttonStyle}>
            <Pressable
              onPress={onPress}
              disabled={buttonLocked}
              style={[
                styles.recordButton,
                showStop
                  ? styles.recordButtonActive
                  : processing || saving
                    ? styles.recordButtonProcessing
                    : styles.recordButtonIdle,
                buttonLocked ? styles.recordButtonDisabled : null,
              ]}
            >
              {showSpinner ? (
                <ActivityIndicator color="#8a9e82" size="large" />
              ) : showStop ? (
                <Square size={34} color="#c8893a" fill="#c8893a" />
              ) : (
                <Mic size={34} color="#5f9470" />
              )}
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.captionBlock}>
          <Text className="text-center font-sans-medium text-sm text-primary">
            {statusLabel}
          </Text>
          {helperText ? (
            <Text className="text-center font-sans text-xs text-muted-foreground">
              {helperText}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "center",
    width: "100%",
  },
  topSection: {
    alignItems: "center",
  },
  captionBlock: {
    marginTop: 12,
    gap: 4,
    alignItems: "center",
  },
  recordWrap: {
    width: RECORD_SIZE,
    height: RECORD_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  recordGlow: {
    position: "absolute",
    width: RECORD_SIZE,
    height: RECORD_SIZE,
    borderRadius: RECORD_RADIUS,
    backgroundColor: "#5f9470",
  },
  recordButton: {
    width: RECORD_SIZE,
    height: RECORD_SIZE,
    borderRadius: RECORD_RADIUS,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonIdle: {
    borderColor: "rgba(95, 148, 112, 0.45)",
    backgroundColor: "rgba(95, 148, 112, 0.12)",
  },
  recordButtonActive: {
    borderColor: "#c8893a",
    backgroundColor: "rgba(200, 137, 58, 0.2)",
  },
  recordButtonProcessing: {
    borderColor: "rgba(138, 158, 130, 0.35)",
    backgroundColor: "rgba(36, 48, 32, 0.65)",
  },
  recordButtonDisabled: {
    opacity: 0.72,
  },
});
