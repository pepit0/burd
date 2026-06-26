import { Pressable, Text } from "react-native";
import { Check, UserPlus } from "lucide-react-native";

interface FollowButtonProps {
  following: boolean;
  onPress: () => void;
  size?: "sm" | "md";
}

export function FollowButton({ following, onPress, size = "sm" }: FollowButtonProps) {
  const pad = size === "md" ? "px-5 py-2.5" : "px-3.5 py-2";
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full ${pad} ${
        following ? "border border-border bg-card" : "bg-primary"
      } active:opacity-80`}
    >
      {following ? (
        <Check size={13} color="#8a9e82" />
      ) : (
        <UserPlus size={13} color="#f0ead6" />
      )}
      <Text
        className={`font-sans-medium text-xs ${
          following ? "text-muted-foreground" : "text-primary-foreground"
        }`}
      >
        {following ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}
