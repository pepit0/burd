import { useState, type ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Feather,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react-native";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { Avatar } from "@/components/Avatar";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { timeAgo } from "@/lib/time";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import type { FeedSighting } from "@/types";

interface SightingCardProps {
  sighting: FeedSighting;
  liked: boolean;
  onToggleLike: () => void;
}

const FEED_ACTION_ICON_SIZE = 14;

function FeedMetric({
  onPress,
  icon,
  count,
}: {
  onPress: () => void;
  icon: ReactNode;
  count: number;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5">
      {icon}
      <Text className="text-xs text-muted-foreground">{count}</Text>
    </Pressable>
  );
}

export function SightingCard({ sighting: s, liked, onToggleLike }: SightingCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openPost = () => router.push(`/post/${s.id}`);
  const audioPlayback = useAudioPlayback(isAudioSighting(s) ? s.audio_url : null);

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      {isAudioSighting(s) ? (
        <View className="h-48 bg-muted">
          <PlaybackWaveform
            playback={audioPlayback}
            className="h-full w-full"
            variant="hero"
            interactive
          />
          <LinearGradient
            colors={["transparent", "rgba(31,42,28,0.2)", "rgba(31,42,28,0.95)"]}
            className="absolute inset-0"
            pointerEvents="none"
          />
          <Pressable
            onPress={openPost}
            className="absolute bottom-3 left-3 right-3 flex-row items-end justify-between active:opacity-95"
          >
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
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={openPost} className="active:opacity-95">
          <View className="h-48 bg-muted">
            {isPhotoSighting(s) ? (
              <Image
                source={{ uri: s.photo_url! }}
                className="h-full w-full"
                resizeMode="cover"
              />
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
        </Pressable>
      )}

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
          <Text className="font-sans text-sm leading-relaxed text-foreground/80">{s.notes}</Text>
        ) : null}
        <Text className="mt-1 font-mono text-[11px] text-muted-foreground/50">
          {timeAgo(s.created_at)}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center gap-4 border-t border-border px-4 py-3">
        <FeedMetric
          onPress={onToggleLike}
          count={s.like_count}
          icon={
            <Heart
              size={FEED_ACTION_ICON_SIZE}
              color={liked ? "#f87171" : "#8a9e82"}
              fill={liked ? "#f87171" : "transparent"}
            />
          }
        />
        <FeedMetric
          onPress={openPost}
          count={s.comment_count ?? 0}
          icon={<MessageCircle size={FEED_ACTION_ICON_SIZE} color="#8a9e82" />}
        />
        <Pressable className="ml-auto" onPress={() => setOptionsOpen(true)}>
          <MoreHorizontal size={14} color="#8a9e82" />
        </Pressable>
      </View>

      <PostOptionsMenu
        sightingId={s.id}
        userId={userId}
        ownerUserId={s.user_id}
        hasPhoto={Boolean(s.photo_url)}
        authorDisqualified={Boolean(s.author_disqualified)}
        isAdmin={isAdmin}
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
      />
    </View>
  );
}
