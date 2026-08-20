import { memo, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  IMAGE_OVERLAY_GRADIENT,
  ImageOverlayText,
} from "@/components/ImageOverlayText";
import { useRouter } from "expo-router";
import {
  Feather,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react-native";
import { LikeBurstOverlay } from "@/components/LikeBurstOverlay";
import { SightingPhotoCarousel } from "@/components/SightingPhotoCarousel";
import { LikeIcon } from "@/components/LikeIcon";
import { useLikeIconStyle } from "@/components/LikeIconStyleProvider";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { Avatar } from "@/components/Avatar";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import { PostInlineAudio } from "@/components/PostInlineAudio";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useLikeWithBurst } from "@/hooks/useLikeWithBurst";
import { useSingleDoubleTap } from "@/hooks/useSingleDoubleTap";
import { sightingPlaceLine, postedDate } from "@/lib/sightingFormat";
import { timeAgo } from "@/lib/time";
import {
  isCombinedMediaSighting,
  sightingHeroIsAudio,
  sightingHeroIsPhoto,
} from "@/lib/sightingMedia";
import { postAudioPlaybackOptions } from "@/lib/sightingAudio";
import { useFeedPhotoLayout } from "@/hooks/useFeedPhotoLayout";
import { getSightingPhotos, sightingPhotosForDisplay } from "@/lib/sightingPhotos";
import type { FeedSighting, SightingPhoto } from "@/types";

function CardSpeciesOverlay({ sighting: s }: { sighting: FeedSighting }) {
  const scientificName = s.scientific_name?.trim();

  return (
    <View className="p-5">
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

interface SightingCardProps {
  sighting: FeedSighting;
  liked: boolean;
  onToggleLike: () => void;
  onUserBlocked?: (userId: string) => void;
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

function CardPhotoArea({
  sighting,
  onPhotoPress,
  burstKey,
  likeIconStyle,
}: {
  sighting: FeedSighting;
  onPhotoPress: () => void;
  burstKey: number;
  likeIconStyle: ReturnType<typeof useLikeIconStyle>["likeIconStyle"];
}) {
  const [photos, setPhotos] = useState<SightingPhoto[]>(() =>
    sightingPhotosForDisplay(sighting),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex] ?? photos[0] ?? null;
  const overlaySighting: FeedSighting = {
    ...sighting,
    species: activePhoto?.species?.trim() || sighting.species,
    scientific_name: activePhoto?.scientific_name ?? sighting.scientific_name,
  };
  const { frameAspect, imageAspect, contentFit, useBlurredFill } =
    useFeedPhotoLayout(activePhoto?.photo_url);

  useEffect(() => {
    if ((sighting.photo_count ?? 0) <= 1 && !sighting.photos?.length) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const rows = await getSightingPhotos(sighting.id);
          if (!cancelled && rows.length > 0) setPhotos(rows);
        } catch {
          // keep cover photo fallback
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [sighting.id, sighting.photo_count, sighting.photos?.length]);

  return (
    <View className="bg-muted" style={{ aspectRatio: frameAspect }}>
      {photos.length > 0 ? (
        <SightingPhotoCarousel
          photos={photos}
          aspectRatio={frameAspect}
          imageAspect={imageAspect}
          contentFit={contentFit}
          useBlurredFill={useBlurredFill}
          pinchEnabled={false}
          onPhotoPress={onPhotoPress}
          onIndexChange={setActiveIndex}
          className="h-full w-full"
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
        <CardSpeciesOverlay sighting={overlaySighting} />
      </View>
    </View>
  );
}

export const SightingCard = memo(function SightingCard({
  sighting: s,
  liked,
  onToggleLike,
  onUserBlocked,
}: SightingCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const openPost = useCallback(() => {
    router.push(`/post/${s.id}`);
  }, [router, s.id]);
  const audioOptions = useMemo(
    () => ({
      ...postAudioPlaybackOptions(s),
      deferLoad: true,
    }),
    [s.published_at, s.published_audio_start_ms, s.published_audio_end_ms],
  );
  const audioPlayback = useAudioPlayback(
    sightingHeroIsAudio(s) ? s.audio_url : null,
    undefined,
    audioOptions,
  );
  const placeLine = sightingPlaceLine(s);
  const { likeIconStyle } = useLikeIconStyle();
  const { burstKey, likeWithBurst, likeWithBurstIfNeeded } = useLikeWithBurst({
    liked,
    onToggleLike,
  });

  const onPhotoPress = useSingleDoubleTap(openPost, likeWithBurstIfNeeded);

  return (
    <View className="overflow-hidden rounded-3xl bg-card">
      {sightingHeroIsAudio(s) ? (
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
        </View>
      ) : (
        <View className="active:opacity-98">
          {sightingHeroIsPhoto(s) ? (
            <CardPhotoArea
              sighting={s}
              onPhotoPress={onPhotoPress}
              burstKey={burstKey}
              likeIconStyle={likeIconStyle}
            />
          ) : (
            <View className="aspect-[4/5] bg-muted" style={{ aspectRatio: 4 / 5 }}>
              <View className="h-full w-full items-center justify-center">
                <Feather size={36} color="#3a4e35" />
              </View>
            </View>
          )}
        </View>
      )}

      <View className="gap-3 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push(`/user/${s.user_id}`)}
            className="min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-70"
          >
            <Avatar user={s.username} color={s.avatar_color} avatarUrl={s.avatar_url} size={32} />
            <View className="min-w-0 flex-1" pointerEvents="none">
              <Text className="font-sans-medium text-sm text-foreground">@{s.username}</Text>
              {placeLine ? (
                <Text className="font-sans text-xs text-muted-foreground" numberOfLines={1}>
                  {placeLine}
                </Text>
              ) : null}
              <Text className="font-sans text-xs text-muted-foreground">
                {timeAgo(postedDate(s).toISOString())}
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

        {isCombinedMediaSighting(s) ? (
          <View className="px-5">
            <PostInlineAudio
              audioUrl={s.audio_url!}
              trimOptions={postAudioPlaybackOptions(s)}
              deferLoad
            />
            {s.audio_source ? (
              <Text className="mt-1 text-right font-sans text-[11px] text-muted-foreground">
                recorded by @{s.audio_source.username}
              </Text>
            ) : null}
          </View>
        ) : null}

        {s.companions && s.companions.length > 0 ? (
          <Text className="px-5 font-sans text-xs text-muted-foreground">
            with {s.companions.map((c) => `@${c.username}`).join(", ")}
          </Text>
        ) : null}

        {s.notes ? (
          <Pressable onPress={openPost} className="active:opacity-80">
            <Text
              pointerEvents="none"
              className="font-sans text-sm leading-relaxed text-foreground/75"
              numberOfLines={2}
            >
              {s.notes}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <PostOptionsMenu
        sightingId={s.id}
        userId={userId}
        ownerUserId={s.user_id}
        ownerUsername={s.username}
        hasPhoto={Boolean(s.photo_url)}
        authorDisqualified={Boolean(s.author_disqualified)}
        isAdmin={isAdmin}
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onUserBlocked={() => onUserBlocked?.(s.user_id)}
      />
    </View>
  );
}, (prev, next) =>
  prev.sighting.id === next.sighting.id &&
  prev.liked === next.liked &&
  prev.sighting.like_count === next.sighting.like_count &&
  prev.sighting.comment_count === next.sighting.comment_count,
);
