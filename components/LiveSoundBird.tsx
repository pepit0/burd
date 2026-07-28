import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

interface LiveSoundBirdProps {
  listening: boolean;
  processing: boolean;
  scale?: number;
}

export function LiveSoundBird({
  listening,
  processing,
  scale = 1,
}: LiveSoundBirdProps) {
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const blink = useSharedValue(1);
  const wing = useSharedValue(0);
  const bounce = useSharedValue(1);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);

  useEffect(() => {
    if (listening) {
      tilt.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 450, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      wing.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 280 }),
          withTiming(0, { duration: 280 }),
        ),
        -1,
        false,
      );
      bounce.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 350, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
      return;
    }

    tilt.value = withTiming(0, { duration: 300 });
    wing.value = withTiming(0, { duration: 300 });
    bounce.value = withTiming(1, { duration: 300 });
  }, [listening, tilt, wing, bounce]);

  useEffect(() => {
    if (listening || processing) return;

    const blinkLoop = () => {
      blink.value = withDelay(
        2200 + Math.random() * 1800,
        withSequence(
          withTiming(0.08, { duration: 90 }),
          withTiming(1, { duration: 120 }),
        ),
      );
    };

    blinkLoop();
    const timer = setInterval(blinkLoop, 4200);
    return () => clearInterval(timer);
  }, [blink, listening, processing]);

  useEffect(() => {
    if (!processing) return;
    tilt.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 200 }),
        withTiming(-0.6, { duration: 200 }),
      ),
      -1,
      true,
    );
  }, [processing, tilt]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bounce.value * scale },
      { translateY: interpolate(bob.value, [0, 1], [6, -10]) * scale },
      { rotate: `${interpolate(tilt.value, [-1, 1], [-8, 8])}deg` },
    ],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));

  const wingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(wing.value, [0, 1], [0, -18])}deg` },
      { translateY: interpolate(wing.value, [0, 1], [0, -3]) },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, bodyStyle]}>
      <Svg width={120} height={110} viewBox="0 0 120 110">
        <Ellipse cx={58} cy={72} rx={34} ry={28} fill="#4a7358" />
        <Ellipse cx={58} cy={76} rx={22} ry={18} fill="#6b9478" opacity={0.55} />
        <Circle cx={58} cy={38} r={26} fill="#5f9470" />
        <Circle cx={58} cy={42} r={17} fill="#74a882" opacity={0.45} />
        <Path d="M78 36 L98 40 L78 46 Z" fill="#c8893a" />
        <Circle cx={68} cy={34} r={3.5} fill="#243022" />
      </Svg>
      <Animated.View style={[styles.eye, eyeStyle]}>
        <View style={styles.eyeWhite} />
        <View style={styles.eyePupil} />
      </Animated.View>
      <Animated.View style={[styles.wing, wingStyle]}>
        <Svg width={36} height={28} viewBox="0 0 36 28">
          <Ellipse cx={18} cy={16} rx={16} ry={11} fill="#4a7358" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 120,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  eye: {
    position: "absolute",
    top: 28,
    left: 62,
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeWhite: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#f0ead6",
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#243022",
  },
  wing: {
    position: "absolute",
    top: 52,
    left: 18,
  },
});
