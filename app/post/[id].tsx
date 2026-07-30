import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import {
  ArrowLeft,
  Feather,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
} from "lucide-react-native";
import { LikeBurstOverlay } from "@/components/LikeBurstOverlay";
import { SightingPhotoCarousel } from "@/components/SightingPhotoCarousel";
import { LikeIcon } from "@/components/LikeIcon";
import { useLikeIconStyle } from "@/components/LikeIconStyleProvider";
import { INACTIVE_ICON_COLOR_ON_DARK } from "@/lib/likeIconStyle";
import { Avatar } from "@/components/Avatar";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { PostComments } from "@/components/PostComments";
import { PostOptionsMenu } from "@/components/PostOptionsMenu";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { SightingDetailsSection } from "@/components/SightingDetailsSection";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { getCommentCountForSighting } from "@/lib/comments";
import { getLoadErrorMessage } from "@/lib/errors";
import { triggerLikeHaptic } from "@/lib/haptics";
import {
  getFeedPostById,
  getMyLikedIds,
  getMyRepostedIds,
  setLike,
  setRepost,
} from "@/lib/sightings";
import { postedDate, sightingPlaceLine } from "@/lib/sightingFormat";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import { SIGHTING_PHOTO_ASPECT } from "@/lib/sightingPhotoFrame";
import { sightingPhotosForDisplay } from "@/lib/sightingPhotos";
import { timeAgo } from "@/lib/time";
import type { FeedSighting, SightingPhoto } from "@/types";

const PHOTO_WIDTH = Dimensions.get("window").width;
const PHOTO_HEIGHT = PHOTO_WIDTH / SIGHTING_PHOTO_ASPECT;
const ACTION_ICON_SIZE = 26;

function PostAction({
  onPress,
  disabled,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-11 w-11 items-center justify-center active:opacity-70 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {children}
    </Pressable>
  );
}

function likeLabel(count: number): string {
  if (count === 0) return "Be the first to like this";
  if (count === 1) return "1 like";
  return `${count} likes`;
}

function commentLabel(count: number): string {
  if (count === 0) return "No comments yet";
  if (count === 1) return "1 comment";
  return `${count} comments`;
}

function repostLabel(count: number): string {
  if (count === 0) return "No reposts yet";
  if (count === 1) return "1 repost";
  return `${count} reposts`;
}

function routeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function PostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; commentId?: string | string[] }>();
  const id = routeParam(params.id);
  const commentId = routeParam(params.commentId);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);

  const [post, setPost] = useState<FeedSighting | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const scrollRef = useRef<React.ElementRef<typeof KeyboardScreen>>(null);
  const commentsYRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const audioPlayback = useAudioPlayback(post?.audio_url ?? null);
  const { likeIconStyle } = useLikeIconStyle();
  const postPhotos = useMemo(
    () => (post ? sightingPhotosForDisplay(post) : []),
    [post],
  );
  const activePhoto = postPhotos[activePhotoIndex] ?? postPhotos[0] ?? null;

  const loadPost = useCallback(async (showSpinner: boolean) => {
    if (!id) {
      setError("Missing post.");
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setError(null);
    try {
      const row = await getFeedPostById(id);
      if (!row) {
        setError("Post not found.");
        setPost(null);
        return;
      }
      setPost(row);
      setLikeCount(row.like_count);
      setRepostCount(row.repost_count ?? 0);
      setCommentCount(
        row.comment_count ?? (await getCommentCountForSighting(row.id)),
      );
      if (userId) {
        const [likedIds, repostedIds] = await Promise.all([
          getMyLikedIds(userId),
          getMyRepostedIds(userId),
        ]);
        setLiked(likedIds.has(row.id));
        setReposted(repostedIds.has(row.id));
      }
    } catch (e) {
      setError(getLoadErrorMessage(e));
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [id, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadPost(true);
      if (!cancelled) {
        initialLoadDoneRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPost]);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDoneRef.current) return;
      void loadPost(false);
    }, [loadPost]),
  );

  async function toggleLike() {
    if (!userId || !post || liking) return;
    const next = !liked;
    if (next) {
      triggerLikeHaptic();
      setBurstKey((key) => key + 1);
    }
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setLiking(true);
    try {
      await setLike(userId, post.id, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setLiking(false);
    }
  }

  function likeIfNeeded() {
    if (!liked) {
      void toggleLike();
    }
  }

  const doubleTapLike = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          runOnJS(likeIfNeeded)();
        }),
    // likeIfNeeded closes over liked/toggleLike; recreate when like state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liked, liking, post?.id, userId],
  );

  async function toggleRepost() {
    if (!userId || !post || reposting || post.user_id === userId) return;
    const next = !reposted;
    if (next) {
      triggerLikeHaptic();
    }
    setReposted(next);
    setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setReposting(true);
    try {
      await setRepost(userId, post.id, next);
    } catch {
      setReposted(!next);
      setRepostCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setReposting(false);
    }
  }

  function scrollToComments() {
    scrollRef.current?.scrollTo({ y: commentsYRef.current, animated: true });
  }

  useEffect(() => {
    if (!commentId || loading || !post) return;
    const timer = setTimeout(() => {
      scrollToComments();
    }, 250);
    return () => clearTimeout(timer);
  }, [commentId, loading, post]);

  const isRemoved = Boolean(post?.removed_at);
  const authorDisqualified = Boolean(post?.author_disqualified);
  const canSeeRemoval =
    post !== null && isRemoved && (isAdmin || post.user_id === userId);
  const canSeeAuthorDisqualification =
    post !== null &&
    authorDisqualified &&
    !isRemoved &&
    (isAdmin || post.user_id === userId);
  const showPost = Boolean(post) && (!isRemoved || canSeeRemoval);
  const publicPlaceLine = post ? sightingPlaceLine(post) : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-3 pb-3 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        {post ? (
          <Pressable
            onPress={() => router.push(`/user/${post.user_id}`)}
            className="flex-row items-center gap-2 active:opacity-80"
          >
            <Avatar user={post.username} color={post.avatar_color} avatarUrl={post.avatar_url} size={28} />
            <Text className="font-sans-medium text-sm text-foreground">
              @{post.username}
            </Text>
          </Pressable>
        ) : (
          <Text className="font-sans-medium text-sm text-foreground">Post</Text>
        )}
        <Pressable
          onPress={() => setOptionsOpen(true)}
          className="rounded-full p-2 active:bg-card"
        >
          <MoreHorizontal size={20} color="#8a9e82" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-20" color="#5f9470" />
      ) : error || !post || !showPost ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          {error ?? "Post not found."}
        </Text>
      ) : (
        <KeyboardScreen ref={scrollRef} showsVerticalScrollIndicator={false}>
          {canSeeRemoval ? (
            <View className="border-b border-destructive/30 bg-destructive/10 px-4 py-4">
              <Text className="font-sans-medium text-sm text-foreground">Post removed</Text>
              <Text className="mt-1 font-sans text-sm text-muted-foreground">
                {post.removal_reason ?? "This post was removed by a moderator."}
              </Text>
            </View>
          ) : null}

          {canSeeAuthorDisqualification ? (
            <View className="border-b border-accent/30 bg-accent/10 px-4 py-4">
              <Text className="font-sans-medium text-sm text-foreground">
                Field guide author credit removed
              </Text>
              <Text className="mt-1 font-sans text-sm text-muted-foreground">
                {post.author_disqualification_reason ??
                  "This sighting no longer counts as the first capture for field guide credit."}
              </Text>
            </View>
          ) : null}

          <View
            className="bg-muted"
            style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
          >
            {isPhotoSighting(post) && !isRemoved ? (
              <SightingPhotoCarousel
                photos={postPhotos}
                contentFit="contain"
                overlayGesture={doubleTapLike}
                style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
                onIndexChange={setActivePhotoIndex}
              />
              ) : isAudioSighting(post) && !isRemoved ? (
                <PlaybackWaveform
                  playback={audioPlayback}
                  className="h-full w-full"
                  variant="hero"
                  interactive
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Feather size={40} color="#3a4e35" />
                </View>
              )}
              <LikeBurstOverlay burstKey={burstKey} iconStyle={likeIconStyle} heroSize={88} />
          </View>

          {!isRemoved ? (
            <>
          <View className="flex-row items-center gap-1 px-3 py-2">
            <PostAction onPress={toggleLike} disabled={!userId || liking}>
              <LikeIcon
                liked={liked}
                style={likeIconStyle}
                size={ACTION_ICON_SIZE}
                inactiveColor={INACTIVE_ICON_COLOR_ON_DARK}
              />
            </PostAction>
            <PostAction onPress={scrollToComments}>
              <MessageCircle size={ACTION_ICON_SIZE} color="#eee8d4" />
            </PostAction>
            <PostAction
              onPress={toggleRepost}
              disabled={!userId || reposting || post.user_id === userId}
            >
              <Repeat2
                size={ACTION_ICON_SIZE}
                color={reposted ? "#5f9470" : "#eee8d4"}
              />
            </PostAction>
            <PostAction disabled>
              <Share2 size={ACTION_ICON_SIZE} color="#eee8d4" />
            </PostAction>
          </View>

          <View className="px-4">
            <Text className="font-sans-medium text-sm text-foreground">
              {likeLabel(likeCount)}
            </Text>
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
              {commentLabel(commentCount)}
            </Text>
            {repostCount > 0 ? (
              <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
                {repostLabel(repostCount)}
              </Text>
            ) : null}

            <Text className="mt-2 font-sans text-sm leading-relaxed text-foreground">
              <Text className="font-sans-medium">@{post.username}</Text>{" "}
              <SpeciesNameLink
                species={activePhoto?.species?.trim() || post.species}
                scientificName={activePhoto?.scientific_name ?? post.scientific_name}
                className="font-serif-semibold text-primary"
              />
              {post.notes ? (
                <Text className="text-foreground/85"> · {post.notes}</Text>
              ) : null}
            </Text>

            {publicPlaceLine ? (
              <Text className="mt-1 font-sans text-xs text-muted-foreground">
                {publicPlaceLine}
              </Text>
            ) : null}

            <Text className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
              {timeAgo(postedDate(post).toISOString())}
            </Text>
          </View>

          <View className="mt-4">
            <SightingDetailsSection sighting={post} viewerUserId={userId} />
          </View>

          <View
            onLayout={(e) => {
              commentsYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <PostComments
              sightingId={post.id}
              postAuthorUserId={post.user_id}
              userId={userId}
              highlightCommentId={commentId ?? null}
              onCommentCountChange={setCommentCount}
              onUserBlocked={() => router.back()}
            />
          </View>
            </>
          ) : null}
        </KeyboardScreen>
      )}

      {post ? (
        <PostOptionsMenu
          sightingId={post.id}
          userId={userId}
          ownerUserId={post.user_id}
          ownerUsername={post.username}
          hasPhoto={Boolean(post.photo_url)}
          authorDisqualified={authorDisqualified}
          isAdmin={isAdmin}
          visible={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          onPostRemoved={() => router.back()}
          onUserBlocked={() => router.back()}
          onAuthorRemoved={() => {
            setPost((current) =>
              current
                ? {
                    ...current,
                    author_disqualified: true,
                    author_disqualification_reason:
                      "Field guide author credit was removed by a moderator.",
                  }
                : current,
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
