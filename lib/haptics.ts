import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Tab bar selection. No-op on web. */
export function triggerTabHaptic(): void {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Light tap feedback when liking a post. No-op on web. */
export function triggerLikeHaptic(): void {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Stronger feedback when publishing a sighting to profile / feed. No-op on web. */
export async function triggerPostHaptic(): Promise<void> {
  if (Platform.OS === "web") return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await new Promise((resolve) => setTimeout(resolve, 55));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
