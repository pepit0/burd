import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
} from "@/lib/comments";
import { getErrorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/time";
import type { Comment } from "@/types";

interface PostCommentsProps {
  sightingId: string;
  userId: string | null;
  onCommentCountChange?: (count: number) => void;
}

function CommentRow({
  comment,
  nested = false,
  onReply,
  canReply,
}: {
  comment: Comment;
  nested?: boolean;
  onReply: (comment: Comment) => void;
  canReply: boolean;
}) {
  return (
    <View className={nested ? "ml-10 mt-3" : "mt-4"}>
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
            <Pressable disabled className="flex-row items-center gap-1 opacity-50">
              <Heart size={12} color="#8a9e82" />
            </Pressable>
            {canReply ? (
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
          onReply={onReply}
          canReply={canReply}
        />
      ))}
    </View>
  );
}

export function PostComments({
  sightingId,
  userId,
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
      const rows = await getCommentsForSighting(sightingId);
      setComments(rows);
      onCommentCountChange?.(countComments(rows));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sightingId, onCommentCountChange]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

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
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

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
            onReply={setReplyTo}
            canReply={!!userId}
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
