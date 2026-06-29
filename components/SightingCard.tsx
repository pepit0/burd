import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Camera,
  Feather,
  Heart,
  MapPin,
  Mic,
  MoreHorizontal,
} from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Avatar } from "@/components/Avatar";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { timeAgo } from "@/lib/time";
import type { FeedSighting } from "@/types";

interface SightingCardProps {
  sighting: FeedSighting;
  liked: boolean;
  onToggleLike: () => void;
}

export function SightingCard({ sighting: s, liked, onToggleLike }: SightingCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isAdmin } = useAdmin(userId);
  const userId = user?.id ?? null;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openPost = () => router.push(`/post/${s.id}`);

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable onPress={openPost} className="active:opacity-95">
        <View className="h-48 bg-muted">
          {s.photo_url ? (
            <Image
              source={{ uri: s.photo_url }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : s.audio_url ? (
            <View className="h-full w-full items-center justify-center gap-2 bg-primary/10">
              <Mic size={32} color="#5f9470" />
              <Text className="font-mono text-[10px] uppercase tracking-widest text-primary/80">
                Bird call
              </Text>
            </View>
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Feather size={32} color="#3a4e35" />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(31,42,28,0.2)", "rgba(31,42,28,0.95)"]}
            className="absolute inset-0"
          />
          <View className="absolute bottom-3 left-3 right-3 flex-row items-end justify-between">
            <View className="flex-1 pr-2">
              <SpeciesNameLink
                species={s.species}
                scientificName={s.scientific_name}
                className="font-serif-semibold text-lg leading-tight text-foreground"
              />
              {s.scientific_name ? (
                <Text className="font-serif-italic text-[11px] text-foreground/60">
                  {s.scientific_name}
                </Text>
              ) : null}
            </View>
            <View className="items-end gap-1.5">
              <RarityBadge rarity={s.rarity} />
              <Text className="font-mono text-[11px] text-accent">×{s.count}</Text>
            </View>
          </View>
        </View>

        <View className="px-4 pb-1 pt-3">
          <View className="mb-2 flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push(`/user/${s.user_id}`)}
              className="flex-row items-center gap-2 active:opacity-70"
            >
              <Avatar user={s.username} color={s.avatar_color} size={24} />
              <Text className="text-xs text-muted-foreground">@{s.username}</Text>
            </Pressable>
            {s.location_name ? (
              <View className="ml-auto flex-row items-center gap-1">
                <MapPin size={10} color="#c8893a" />
                <Text className="text-[11px] text-muted-foreground">{s.location_name}</Text>
              </View>
            ) : null}
          </View>
          {s.notes ? (
            <Text className="font-sans text-sm leading-relaxed text-foreground/80">
              {s.notes}
            </Text>
          ) : null}
          {s.audio_url ? (
            <View className="mt-2">
              <AudioPlayer uri={s.audio_url} compact />
            </View>
          ) : null}
          <Text className="mt-1 font-mono text-[11px] text-muted-foreground/50">
            {timeAgo(s.created_at)}
          </Text>
        </View>
      </Pressable>

      <View className="mt-2 flex-row items-center gap-4 border-t border-border px-4 py-3">
        <Pressable className="flex-row items-center gap-1.5" onPress={onToggleLike}>
          <Heart
            size={14}
            color={liked ? "#f87171" : "#8a9e82"}
            fill={liked ? "#f87171" : "transparent"}
          />
          <Text className="text-xs text-muted-foreground">{s.like_count}</Text>
        </Pressable>
        <Pressable className="flex-row items-center gap-1.5" onPress={openPost}>
          <Camera size={14} color="#8a9e82" />
          <Text className="text-xs text-muted-foreground">View</Text>
        </Pressable>
        <Pressable className="ml-auto" onPress={() => setOptionsOpen(true)}>
          <MoreHorizontal size={14} color="#8a9e82" />
        </Pressable>
      </View>

      <PostOptionsMenu
        sightingId={s.id}
        userId={userId}
        hasPhoto={Boolean(s.photo_url)}
        authorDisqualified={Boolean(s.author_disqualified)}
        isAdmin={isAdmin}
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
      />
    </View>
  );
}
