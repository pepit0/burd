import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";

const BELL_SIZE = 18;
const BELL_PIVOT = BELL_SIZE / 2;
const SHAKE_INTERVAL_MS = 30_000;

const BELL_SWING = Easing.inOut(Easing.sin);
const BELL_SETTLE = Easing.out(Easing.sin);

function triggerBellShake(rotation: SharedValue<number>) {
  rotation.value = withSequence(
    withTiming(-8, { duration: 140, easing: BELL_SWING }),
    withTiming(8, { duration: 140, easing: BELL_SWING }),
    withTiming(-6, { duration: 130, easing: BELL_SWING }),
    withTiming(6, { duration: 130, easing: BELL_SWING }),
    withTiming(-3, { duration: 120, easing: BELL_SWING }),
    withTiming(3, { duration: 120, easing: BELL_SWING }),
    withTiming(0, { duration: 160, easing: BELL_SETTLE }),
  );
}

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount } = useNotificationBadge();
  const { reduceMotion } = useAccessibility();
  const rotation = useSharedValue(0);

  const animatedBellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -BELL_PIVOT },
      { rotate: `${rotation.value}deg` },
      { translateY: BELL_PIVOT },
    ],
  }));

  useEffect(() => {
    if (unreadCount <= 0 || reduceMotion) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }

    triggerBellShake(rotation);
    const intervalId = setInterval(
      () => triggerBellShake(rotation),
      SHAKE_INTERVAL_MS,
    );

    return () => {
      clearInterval(intervalId);
      cancelAnimation(rotation);
      rotation.value = 0;
    };
  }, [unreadCount, reduceMotion, rotation]);

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      className="relative rounded-full p-2 active:bg-card"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
    >
      <Animated.View style={animatedBellStyle}>
        <Bell size={BELL_SIZE} color="#8a9e82" />
      </Animated.View>
      {unreadCount > 0 ? (
        <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
      ) : null}
    </Pressable>
  );
}
