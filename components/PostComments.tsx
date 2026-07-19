import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Heart, MessageCircle, SendHorizontal } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { MentionText } from "@/components/MentionText";
import { MentionTextInput } from "@/components/MentionTextInput";
import {
  countComments,
  createComment,
  getCommentsForSighting,
  setCommentLike,
} from "@/lib/comments";
import { getLoadErrorMessage, getUserFacingMessage } from "@/lib/errors";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import { timeAgo } from "@/lib/time";
import type { Comment } from "@/types";

interface PostCommentsProps {
  sightingId: string;
  userId: string | null;
  highlightCommentId?: string | null;
  onCommentCountChange?: (count: number) => void;
}

function updateCommentTree(
  comments: Comment[],
  commentId: string,
  updater: (comment: Comment) => Comment,
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) return updater(comment);
    if (comment.replies?.length) {
      return {
        ...comment,
        replies: updateCommentTree(comment.replies, commentId, updater),
      };
    }
    return comment;
  });
}

function CommentRow({
  comment,
  nested = false,
  userId,
  onReply,
  onToggleLike,
  canInteract,
  highlighted = false,
  highlightCommentId = null,
}: {
  comment: Comment;
  nested?: boolean;
  userId: string | null;
  onReply: (comment: Comment) => void;
  onToggleLike: (commentId: string) => void;
  canInteract: boolean;
  highlighted?: boolean;
  highlightCommentId?: string | null;
}) {
  return (
    <View
      className={`${nested ? "ml-10 mt-3" : "mt-4"} ${
        highlighted ? "rounded-xl bg-primary/10 px-2 py-1" : ""
      }`}
    >
      <View className="flex-row gap-2.5">
        <Avatar user={comment.username} color={comment.avatar_color} size={nested ? 28 : 32} />
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-sm leading-snug text-foreground">
            <Text className="font-sans-medium">@{comment.username}</Text>{" "}
            <MentionText body={comment.body} />
          </Text>
          <View className="mt-1.5 flex-row items-center gap-4">
            <Text className="font-mono text-[10px] text-muted-foreground/50">
              {timeAgo(comment.created_at)}
            </Text>
            <Pressable
              onPress={() => onToggleLike(comment.id)}
              className="flex-row items-center gap-1 active:opacity-70"
            >
              <Heart
                size={12}
                color={comment.liked ? "#f87171" : "#8a9e82"}
                fill={comment.liked ? "#f87171" : "transparent"}
              />
              {comment.like_count > 0 ? (
                <Text className="font-mono text-[10px] text-muted-foreground">
                  {comment.like_count}
                </Text>
              ) : null}
            </Pressable>
            {canInteract ? (
              <Pressable onPress={() => onReply(comment)} className="active:opacity-70">
                <Text className="font-sans-medium text-[11px] text-muted-foreground">
                  Reply
                </Text>
              </Pressable>
            ) : (
              <Pressable disabled className="opacity-50">
                <Text className="font-sans-medium text-[11px] text-muted-foreground">
                  Reply
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {comment.replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          nested
          userId={userId}
          onReply={onReply}
          onToggleLike={onToggleLike}
          canInteract={canInteract}
          highlighted={reply.id === highlightCommentId}
        />
      ))}
    </View>
  );
}

export function PostComments({
  sightingId,
  userId,
  highlightCommentId = null,
  onCommentCountChange,
}: PostCommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getCommentsForSighting(sightingId, userId);
      setComments(rows);
      onCommentCountChange?.(countComments(rows));
    } catch (e) {
      setError(getLoadErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sightingId, userId, onCommentCountChange]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useRetryOnRecover(error, loadComments);

  async function handleSubmit() {
    if (!userId || submitting) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      await createComment(userId, sightingId, trimmed, replyTo?.id ?? null);
      setText("");
      setReplyTo(null);
      await loadComments();
    } catch (e) {
      setError(getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const toggleCommentLike = useCallback(
    (commentId: string) => {
      if (!userId) {
        router.push("/(auth)/login");
        return;
      }

      let wasLiked = false;
      setComments((prev) => {
        const findLiked = (items: Comment[]): boolean | null => {
          for (const item of items) {
            if (item.id === commentId) return item.liked;
            if (item.replies?.length) {
              const nested = findLiked(item.replies);
              if (nested !== null) return nested;
            }
          }
          return null;
        };
        wasLiked = findLiked(prev) ?? false;

        return updateCommentTree(prev, commentId, (comment) => ({
          ...comment,
          liked: !comment.liked,
          like_count: Math.max(0, comment.like_count + (comment.liked ? -1 : 1)),
        }));
      });

      const willLike = !wasLiked;
      setCommentLike(userId, commentId, willLike).catch((e) => {
        setComments((prev) =>
          updateCommentTree(prev, commentId, (comment) => ({
            ...comment,
            liked: wasLiked,
            like_count: Math.max(0, comment.like_count + (willLike ? -1 : 1)),
          })),
        );
        Alert.alert("Could not update like", getUserFacingMessage(e));
      });
    },
    [router, userId],
  );

  const total = countComments(comments);

  return (
    <View className="border-t border-border px-4 pb-4 pt-3">
      <Text className="font-sans-medium text-sm text-foreground">
        Comments{total > 0 ? ` · ${total}` : ""}
      </Text>

      {loading ? (
        <ActivityIndicator className="mt-4" color="#5f9470" />
      ) : error && comments.length === 0 ? (
        <Text className="mt-3 font-sans text-xs text-red-400">{error}</Text>
      ) : comments.length === 0 ? (
        <Text className="mt-1 font-sans text-xs text-muted-foreground">
          No comments yet. Start the conversation.
        </Text>
      ) : (
        comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            userId={userId}
            onReply={setReplyTo}
            onToggleLike={toggleCommentLike}
            canInteract={!!userId}
            highlighted={comment.id === highlightCommentId}
            highlightCommentId={highlightCommentId}
          />
        ))
      )}

      {replyTo ? (
        <View className="mt-4 flex-row items-center justify-between rounded-lg bg-card px-3 py-2">
          <Text className="font-sans text-xs text-muted-foreground">
            Replying to @{replyTo.username}
          </Text>
          <Pressable onPress={() => setReplyTo(null)} className="active:opacity-70">
            <Text className="font-sans-medium text-xs text-accent">Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {error && comments.length > 0 ? (
        <Text className="mt-3 font-sans text-xs text-red-400">{error}</Text>
      ) : null}

      {userId ? (
        <View className="mt-5 overflow-visible rounded-xl border border-border bg-card px-3 py-2.5">
          <View className="flex-row items-center gap-2">
            <MessageCircle size={16} color="#8a9e82" />
            <MentionTextInput
              userId={userId}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"}
              placeholderTextColor="#8a9e82"
              maxLength={2000}
              editable={!submitting}
              className="flex-1 font-sans text-foreground"
            />
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !text.trim()}
              className={`rounded-full p-1.5 active:opacity-70 ${
                submitting || !text.trim() ? "opacity-40" : ""
              }`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#5f9470" />
              ) : (
                <SendHorizontal size={18} color="#5f9470" />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/(auth)/login")}
          className="mt-5 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 active:opacity-80"
        >
          <MessageCircle size={16} color="#8a9e82" />
          <Text className="flex-1 font-sans text-sm text-muted-foreground">
            Sign in to comment
          </Text>
        </Pressable>
      )}
    </View>
  );
}
