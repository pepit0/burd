import { Pressable, Text, View } from "react-native";
import { Check, UserPlus, X } from "lucide-react-native";
import type { FriendshipStatus } from "@/lib/social";

interface FriendButtonProps {
  status: FriendshipStatus;
  onPress: () => void;
  onSecondaryPress?: () => void;
  size?: "sm" | "md";
}

export function FollowButton({
  status,
  onPress,
  onSecondaryPress,
  size = "sm",
}: FriendButtonProps) {
  const pad = size === "md" ? "px-5 py-2.5" : "px-3.5 py-2";

  const isFriends = status === "friends";
  const isOutgoing = status === "outgoing";
  const isIncoming = status === "incoming";

  const label = isFriends
    ? "Friends"
    : isOutgoing
      ? "Requested"
      : isIncoming
        ? "Accept"
        : "Add Birder";

  const icon = isFriends ? (
    <Check size={13} color="#8a9e82" />
  ) : isOutgoing ? (
    <X size={13} color="#8a9e82" />
  ) : (
    <UserPlus size={13} color="#f0ead6" />
  );

  const primaryClass = isFriends || isOutgoing
    ? "border border-border bg-card"
    : "bg-primary";

  const textClass = isFriends || isOutgoing
    ? "text-muted-foreground"
    : "text-primary-foreground";

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        onPress={onPress}
        className={`flex-row items-center gap-1.5 rounded-full ${pad} ${primaryClass} active:opacity-80`}
      >
        {icon}
        <Text className={`font-sans-medium text-xs ${textClass}`}>{label}</Text>
      </Pressable>

      {isIncoming && onSecondaryPress ? (
        <Pressable
          onPress={onSecondaryPress}
          className="rounded-full border border-border bg-card px-3 py-2 active:opacity-80"
          accessibilityLabel="Decline friend request"
        >
          <Text className="font-sans-medium text-xs text-muted-foreground">Decline</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
