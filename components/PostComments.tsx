import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle, MoreHorizontal, SendHorizontal } from "lucide-react-native";
import { LikeIcon } from "@/components/LikeIcon";
import { useLikeIconStyle } from "@/components/LikeIconStyleProvider";
import { Avatar } from "@/components/Avatar";
import { MentionText } from "@/components/MentionText";
import { MentionTextInput } from "@/components/MentionTextInput";
import { UserStatusBadges } from "@/components/UserStatusBadges";
import {
  countComments,
  createComment,
  getCommentsForSighting,
  setCommentLike,
} from "@/lib/comments";
import { getLoadErrorMessage, getUserFacingMessage } from "@/lib/errors";
import { blockUser } from "@/lib/blocks";
import { pickReportReason } from "@/lib/reportReasons";
import { reportComment } from "@/lib/reports";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import { timeAgo } from "@/lib/time";
import type { Comment } from "@/types";

interface PostCommentsProps {
  sightingId: string;
  postAuthorUserId: string;
  userId: string | null;
  highlightCommentId?: string | null;
  onCommentCountChange?: (count: number) => void;
  onUserBlocked?: (blockedUserId: string) => void;
}

function CommentAuthorTag() {
  return (
    <View className="rounded bg-primary/15 px-1.5 py-0.5">
      <Text className="font-mono text-[9px] uppercase tracking-wide text-primary">
        Author
      </Text>
    </View>
  );
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
  isReply = false,
  postAuthorUserId,
  userId,
  onReply,
  onToggleLike,
  onModerate,
  canInteract,
  highlighted = false,
  highlightCommentId = null,
}: {
  comment: Comment;
  isReply?: boolean;
  postAuthorUserId: string;
  userId: string | null;
  onReply: (comment: Comment) => void;
  onToggleLike: (commentId: string) => void;
  onModerate: (comment: Comment) => void;
  canInteract: boolean;
  highlighted?: boolean;
  highlightCommentId?: string | null;
}) {
  const { likeIconStyle } = useLikeIconStyle();
  const isOwnComment = Boolean(userId && userId === comment.user_id);
  const isPostAuthor = comment.user_id === postAuthorUserId;

  return (
    <View
      className={`${isReply ? "mt-3" : "mt-4"} ${
        highlighted ? "rounded-xl bg-primary/10 px-2 py-1" : ""
      }`}
    >
      <View className="flex-row gap-2.5">
        <Avatar
          user={comment.username}
          color={comment.avatar_color}
          avatarUrl={comment.avatar_url}
          size={isReply ? 28 : 32}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-1">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
              <Text className="font-sans-medium text-sm text-foreground">
                @{comment.username}
              </Text>
              <UserStatusBadges isVerified={comment.is_verified} isBeta={false} size="sm" />
              {isPostAuthor ? <CommentAuthorTag /> : null}
            </View>
            {!isOwnComment && userId ? (
              <Pressable
                onPress={() => onModerate(comment)}
                hitSlop={8}
                className="-mr-1 rounded-full p-1 active:bg-card"
                accessibilityLabel="Comment options"
              >
                <MoreHorizontal size={16} color="#8a9e82" />
              </Pressable>
            ) : null}
          </View>
          <Text className="mt-1 font-sans text-sm leading-snug text-foreground">
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
              <LikeIcon liked={comment.liked} style={likeIconStyle} size={12} />
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

      {comment.replies?.length ? (
        <View className={isReply ? undefined : "ml-10"}>
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              isReply
              postAuthorUserId={postAuthorUserId}
              userId={userId}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onModerate={onModerate}
              canInteract={canInteract}
              highlighted={reply.id === highlightCommentId}
              highlightCommentId={highlightCommentId}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PostComments({
  sightingId,
  postAuthorUserId,
  userId,
  highlightCommentId = null,
  onCommentCountChange,
  onUserBlocked,
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

  function removeCommentsByUser(authorId: string, items: Comment[]): Comment[] {
    return items
      .filter((comment) => comment.user_id !== authorId)
      .map((comment) => ({
        ...comment,
        replies: comment.replies?.length
          ? removeCommentsByUser(authorId, comment.replies)
          : comment.replies,
      }));
  }

  const handleCommentModerate = useCallback(
    (comment: Comment) => {
      if (!userId) {
        router.push("/(auth)/login");
        return;
      }

      Alert.alert(`@${comment.username}`, "What would you like to do?", [
        {
          text: "Report comment",
          onPress: () => {
            void (async () => {
              const reason = await pickReportReason("Report comment");
              if (!reason) return;
              try {
                await reportComment(userId, comment.id, reason);
                Alert.alert(
                  "Report submitted",
                  "Thanks — our moderators review reports within 24 hours.",
                );
              } catch (e) {
                Alert.alert("Could not report", getUserFacingMessage(e));
              }
            })();
          },
        },
        {
          text: "Block user",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              `Block @${comment.username}?`,
              "Their content will disappear from your feed immediately. We'll be notified to review this account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Block",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      try {
                        await blockUser(
                          comment.user_id,
                          `Blocked from comment ${comment.id} — user-initiated block with moderation review`,
                        );
                        setComments((prev) => removeCommentsByUser(comment.user_id, prev));
                        onUserBlocked?.(comment.user_id);
                        Alert.alert(
                          "User blocked",
                          `@${comment.username} has been blocked.`,
                        );
                      } catch (e) {
                        Alert.alert("Could not block user", getUserFacingMessage(e));
                      }
                    })();
                  },
                },
              ],
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [onUserBlocked, router, userId],
  );

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
            postAuthorUserId={postAuthorUserId}
            userId={userId}
            onReply={setReplyTo}
            onToggleLike={toggleCommentLike}
            onModerate={handleCommentModerate}
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
