import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Feather,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Star,
  User,
  X,
} from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/time";
import type { ActivityItem, ActivityType } from "@/types";

function ActivityIcon({ type }: { type: ActivityType }) {
  if (type === "like") return <Heart size={12} color="#f87171" fill="rgba(248,113,113,0.4)" />;
  if (type === "follow") return <User size={12} color="#5f9470" />;
  if (type === "comment") return <MessageCircle size={12} color="#8a9e82" />;
  if (type === "log") return <Feather size={12} color="#c8893a" />;
  if (type === "milestone") return <Star size={12} color="#c8893a" fill="rgba(200,137,58,0.4)" />;
  return <MoreHorizontal size={12} color="#8a9e82" />;
}

interface ActivityRowProps {
  event: ActivityItem;
  onOpen?: (event: ActivityItem) => void;
  onClear?: (event: ActivityItem) => void;
  showClear?: boolean;
}

export function ActivityRow({
  event,
  onOpen,
  onClear,
  showClear = false,
}: ActivityRowProps) {
  const router = useRouter();
  const unread = !event.read_at;
  const handle = event.actor?.username ?? "someone";
  const color = event.actor?.avatar_color ?? "#5f9470";

  const goToActor = () => {
    if (event.actor_id) router.push(`/user/${event.actor_id}`);
  };

  const goToPost = () => {
    if (event.sighting_id) router.push(`/post/${event.sighting_id}`);
  };

  const open = () => {
    onOpen?.(event);
    if (event.sighting_id) goToPost();
    else if (event.type === "follow" && event.actor_id) goToActor();
    else if (event.actor_id) goToActor();
  };

  return (
    <Pressable
      onPress={open}
      className={`flex-row items-start gap-3 border-b border-border/40 py-3 active:opacity-90 ${
        unread ? "bg-primary/5" : ""
      }`}
    >
      <Pressable onPress={goToActor} className="relative">
        <Avatar user={handle} color={color} size={36} />
        <View className="absolute -bottom-0.5 -right-0.5 h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
          <ActivityIcon type={event.type} />
        </View>
        {unread ? (
          <View className="absolute -left-0.5 top-0 h-2 w-2 rounded-full bg-accent" />
        ) : null}
      </Pressable>

      <Pressable onPress={goToActor} className="min-w-0 flex-1 pt-0.5">
        <Text
          className={`font-sans text-sm leading-snug text-foreground ${
            unread ? "font-sans-medium" : ""
          }`}
        >
          <Text className="font-sans-medium text-foreground">@{handle}</Text>{" "}
          <Text className="text-foreground/70">{event.detail}</Text>
        </Text>
        <Text className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
          {timeAgo(event.created_at)}
        </Text>
      </Pressable>

      {event.sighting?.photo_url ? (
        <Pressable onPress={goToPost} className="h-11 w-11 overflow-hidden rounded-lg bg-muted">
          <Image
            source={{ uri: event.sighting.photo_url }}
            className="h-full w-full"
            resizeMode="cover"
          />
        </Pressable>
      ) : null}

      {showClear ? (
        <Pressable
          onPress={() => onClear?.(event)}
          hitSlop={8}
          className="mt-1 rounded-full p-1 active:bg-card"
          accessibilityLabel="Clear notification"
        >
          <X size={14} color="#8a9e82" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
