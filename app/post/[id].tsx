import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Feather,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
} from "lucide-react-native";
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
import {
  getFeedPostById,
  getMyLikedIds,
  setLike,
} from "@/lib/sightings";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import { timeAgo } from "@/lib/time";
import type { FeedSighting } from "@/types";

const PHOTO_SIZE = Dimensions.get("window").width;
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

export default function PostScreen() {
  const router = useRouter();
  const { id, commentId } = useLocalSearchParams<{ id: string; commentId?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);

  const [post, setPost] = useState<FeedSighting | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const scrollRef = useRef<React.ElementRef<typeof KeyboardScreen>>(null);
  const commentsYRef = useRef(0);
  const audioPlayback = useAudioPlayback(post?.audio_url ?? null);

  useEffect(() => {
    if (!id) {
      setError("Missing post.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getFeedPostById(id);
        if (cancelled) return;
        if (!row) {
          setError("Post not found.");
          setPost(null);
          return;
        }
        setPost(row);
        setLikeCount(row.like_count);
        if (!cancelled) {
          setCommentCount(
            row.comment_count ?? (await getCommentCountForSighting(row.id)),
          );
        }
        if (userId) {
          const likedIds = await getMyLikedIds(userId);
          if (!cancelled) setLiked(likedIds.has(row.id));
        }
      } catch (e) {
        if (!cancelled) setError(getLoadErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  async function toggleLike() {
    if (!userId || !post || liking) return;
    const next = !liked;
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
            <Avatar user={post.username} color={post.avatar_color} size={28} />
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
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
          >
            {isPhotoSighting(post) && !isRemoved ? (
              <Image
                source={{ uri: post.photo_url! }}
                style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                resizeMode="cover"
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
          </View>

          {!isRemoved ? (
            <>
          <View className="flex-row items-center gap-1 px-3 py-2">
            <PostAction onPress={toggleLike} disabled={!userId || liking}>
              <Heart
                size={ACTION_ICON_SIZE}
                color={liked ? "#f87171" : "#eee8d4"}
                fill={liked ? "#f87171" : "transparent"}
              />
            </PostAction>
            <PostAction onPress={scrollToComments}>
              <MessageCircle size={ACTION_ICON_SIZE} color="#eee8d4" />
            </PostAction>
            <PostAction disabled>
              <Repeat2 size={ACTION_ICON_SIZE} color="#eee8d4" />
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

            <Text className="mt-2 font-sans text-sm leading-relaxed text-foreground">
              <Text className="font-sans-medium">@{post.username}</Text>{" "}
              <SpeciesNameLink
                species={post.species}
                scientificName={post.scientific_name}
                className="font-serif-semibold text-primary"
              />
              {post.notes ? (
                <Text className="text-foreground/85"> · {post.notes}</Text>
              ) : null}
            </Text>

            {post.location_name ? (
              <Text className="mt-1 font-sans text-xs text-muted-foreground">
                {post.location_name}
              </Text>
            ) : null}

            <Text className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">
              {timeAgo(post.created_at)}
            </Text>
          </View>

          <View className="mt-4">
            <SightingDetailsSection sighting={post} />
          </View>

          <View
            onLayout={(e) => {
              commentsYRef.current = e.nativeEvent.layout.y;
            }}
          >
            <PostComments
              sightingId={post.id}
              userId={userId}
              highlightCommentId={commentId ?? null}
              onCommentCountChange={setCommentCount}
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
          hasPhoto={Boolean(post.photo_url)}
          authorDisqualified={authorDisqualified}
          isAdmin={isAdmin}
          visible={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          onPostRemoved={() => router.back()}
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
