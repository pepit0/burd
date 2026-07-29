import { useMemo, useState, useCallback, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  IMAGE_OVERLAY_BADGE_SHADOW,
  IMAGE_OVERLAY_GRADIENT,
  ImageOverlayText,
} from "@/components/ImageOverlayText";
import { useRouter } from "expo-router";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import {
  Feather,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react-native";
import { LikeBurstOverlay } from "@/components/LikeBurstOverlay";
import { PinchZoomImage } from "@/components/PinchZoomImage";
import { LikeIcon } from "@/components/LikeIcon";
import { useLikeIconStyle } from "@/components/LikeIconStyleProvider";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { Avatar } from "@/components/Avatar";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useLikeWithBurst } from "@/hooks/useLikeWithBurst";
import { sightingPlaceLine } from "@/lib/sightingFormat";
import { rarityForSighting } from "@/lib/rarity";
import { timeAgo } from "@/lib/time";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import type { FeedSighting } from "@/types";

function CardSpeciesOverlay({ sighting: s }: { sighting: FeedSighting }) {
  const scientificName = s.scientific_name?.trim();

  return (
    <View className="p-5 pr-28">
      <SpeciesNameLink
        species={s.species}
        scientificName={s.scientific_name}
        overlay
        className="font-serif-semibold text-2xl leading-tight text-foreground"
      />
      {scientificName ? (
        <ImageOverlayText
          className="mt-1 font-serif-italic text-sm text-foreground"
          containerClassName="w-full"
          numberOfLines={1}
        >
          {scientificName}
        </ImageOverlayText>
      ) : null}
    </View>
  );
}

function CardRarityCorner({ rarity }: { rarity: FeedSighting["rarity"] }) {
  return (
    <View
      className="absolute bottom-5 right-5"
      style={IMAGE_OVERLAY_BADGE_SHADOW}
      pointerEvents="none"
    >
      <RarityBadge rarity={rarity} size="lg" />
    </View>
  );
}

interface SightingCardProps {
  sighting: FeedSighting;
  liked: boolean;
  onToggleLike: () => void;
}

function ActionButton({
  onPress,
  icon,
  count,
}: {
  onPress: () => void;
  icon: ReactNode;
  count?: number;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 px-1 py-1">
      {icon}
      {typeof count === "number" ? (
        <Text className="font-sans-medium text-sm text-muted-foreground">{count}</Text>
      ) : null}
    </Pressable>
  );
}

export function SightingCard({ sighting: s, liked, onToggleLike }: SightingCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openPost = useCallback(() => {
    router.push(`/post/${s.id}`);
  }, [router, s.id]);
  const audioPlayback = useAudioPlayback(isAudioSighting(s) ? s.audio_url : null);
  const placeLine = sightingPlaceLine(s);
  const rarity = rarityForSighting(s);
  const { likeIconStyle } = useLikeIconStyle();
  const { burstKey, likeWithBurst, likeWithBurstIfNeeded } = useLikeWithBurst({
    liked,
    onToggleLike,
  });

  const photoGestures = useMemo(() => {
    const doubleTapLike = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        runOnJS(likeWithBurstIfNeeded)();
      });
    const openPostTap = Gesture.Tap()
      .numberOfTaps(1)
      .onEnd(() => {
        runOnJS(openPost)();
      });
    return Gesture.Exclusive(doubleTapLike, openPostTap);
  }, [likeWithBurstIfNeeded, openPost]);

  return (
    <View className="overflow-hidden rounded-3xl bg-card">
      {isAudioSighting(s) ? (
        <View className="aspect-[4/5] bg-muted" style={{ aspectRatio: 4 / 5 }}>
          <PlaybackWaveform
            playback={audioPlayback}
            className="h-full w-full"
            variant="hero"
            interactive
          />
          <LinearGradient
            colors={[...IMAGE_OVERLAY_GRADIENT]}
            className="absolute inset-0"
            pointerEvents="none"
          />
          <LikeBurstOverlay burstKey={burstKey} iconStyle={likeIconStyle} />
          <Pressable
            onPress={openPost}
            className="absolute bottom-0 left-0 right-0 active:opacity-95"
          >
            <CardSpeciesOverlay sighting={s} />
          </Pressable>
          <CardRarityCorner rarity={rarity} />
        </View>
      ) : (
        <View className="active:opacity-98">
          <View className="aspect-[4/5] bg-muted" style={{ aspectRatio: 4 / 5 }}>
            {isPhotoSighting(s) ? (
              <PinchZoomImage
                uri={s.photo_url!}
                className="h-full w-full"
                contentFit="cover"
                overlayGesture={photoGestures}
              />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Feather size={36} color="#3a4e35" />
                </View>
              )}
              <LinearGradient
                colors={[...IMAGE_OVERLAY_GRADIENT]}
                className="absolute inset-0"
                pointerEvents="none"
              />
              <LikeBurstOverlay burstKey={burstKey} iconStyle={likeIconStyle} />
              <View className="absolute bottom-0 left-0 right-0" pointerEvents="none">
                <CardSpeciesOverlay sighting={s} />
              </View>
              <CardRarityCorner rarity={rarity} />
          </View>
        </View>
      )}

      <View className="gap-3 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push(`/user/${s.user_id}`)}
            className="min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-70"
          >
            <Avatar user={s.username} color={s.avatar_color} avatarUrl={s.avatar_url} size={32} />
            <View className="min-w-0 flex-1">
              <Text className="font-sans-medium text-sm text-foreground">@{s.username}</Text>
              {placeLine ? (
                <Text className="font-sans text-xs text-muted-foreground" numberOfLines={1}>
                  {placeLine}
                </Text>
              ) : null}
              <Text className="font-sans text-xs text-muted-foreground">
                {timeAgo(s.created_at)}
              </Text>
            </View>
          </Pressable>

          <View className="flex-row items-center">
            <ActionButton
              onPress={likeWithBurst}
              count={s.like_count}
              icon={
                <LikeIcon liked={liked} style={likeIconStyle} size={22} />
              }
            />
            <ActionButton
              onPress={openPost}
              count={s.comment_count ?? 0}
              icon={<MessageCircle size={20} color="#8a9e82" strokeWidth={2} />}
            />
            <Pressable className="p-1" onPress={() => setOptionsOpen(true)}>
              <MoreHorizontal size={22} color="#8a9e82" />
            </Pressable>
          </View>
        </View>

        {s.notes ? (
          <Text className="font-sans text-sm leading-relaxed text-foreground/75" numberOfLines={2}>
            {s.notes}
          </Text>
        ) : null}
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
