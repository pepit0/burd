import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Mic, Square } from "lucide-react-native";
import { LiveSoundBird } from "@/components/LiveSoundBird";
import { LiveSoundWaveform } from "@/components/LiveSoundWaveform";
import type { LiveSoundStatus } from "@/hooks/useLiveSoundId";

const RECORD_SIZE = 112;
const RECORD_RADIUS = RECORD_SIZE / 2;

interface LiveSoundControlBarProps {
  status: LiveSoundStatus;
  listening: boolean;
  level: number;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function LiveSoundControlBar({
  status,
  listening,
  level,
  saving,
  disabled,
  onPress,
}: LiveSoundControlBarProps) {
  const processing = status === "processing";
  const idle = status === "idle";
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const glowVisible = useSharedValue(1);

  useEffect(() => {
    const shouldAnimate = !listening && !saving && !disabled;

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
  }, [disabled, glow, glowVisible, listening, pulse, saving]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowVisible.value * 0.22 * glow.value,
    transform: [{ scale: 1 + glow.value * 0.14 }],
  }));

  return (
    <View className="overflow-hidden rounded-2xl border border-border/60 bg-card/50">
      <LinearGradient
        colors={
          listening
            ? ["rgba(200,137,58,0.12)", "rgba(95,148,112,0.06)"]
            : ["rgba(95,148,112,0.1)", "rgba(95,148,112,0.03)"]
        }
        style={StyleSheet.absoluteFillObject}
      />

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
                disabled={disabled}
                style={[
                  styles.recordButton,
                  listening ? styles.recordButtonActive : styles.recordButtonIdle,
                  disabled ? styles.recordButtonDisabled : null,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#5f9470" size="large" />
                ) : listening ? (
                  <Square size={34} color="#c8893a" fill="#c8893a" />
                ) : (
                  <Mic size={34} color="#5f9470" />
                )}
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <View style={styles.soundRow}>
          <View style={styles.birdSlot}>
            <LiveSoundBird
              listening={listening}
              processing={processing}
              scale={0.48}
            />
          </View>
          <View style={styles.waveformSlot}>
            <LiveSoundWaveform
              active={listening}
              level={level}
              idleAnimate={idle || processing}
              compact
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topSection: {
    alignItems: "center",
  },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  birdSlot: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  waveformSlot: {
    flex: 1,
    minWidth: 0,
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
  recordButtonDisabled: {
    opacity: 0.55,
  },
});
