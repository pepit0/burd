import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount } = useNotificationBadge();

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
      <Bell size={18} color="#8a9e82" />
      {unreadCount > 0 ? (
        <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
      ) : null}
    </Pressable>
  );
}
