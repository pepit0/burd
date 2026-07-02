import { supabase } from "@/lib/supabase";
import type { Comment } from "@/types";

interface CommentRow {
  id: string;
  sighting_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_color: string;
    avatar_url: string | null;
  };
}

interface CommentLikeRow {
  comment_id: string;
  user_id: string;
}

function mapRow(row: CommentRow): Comment & { parent_id: string | null } {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.profiles.username,
    avatar_color: row.profiles.avatar_color,
    avatar_url: row.profiles.avatar_url,
    body: row.body,
    created_at: row.created_at,
    like_count: 0,
    liked: false,
    parent_id: row.parent_id,
  };
}

function buildCommentTree(flat: (Comment & { parent_id: string | null })[]): Comment[] {
  const nodes = new Map<string, Comment & { replies: Comment[] }>();
  for (const row of flat) {
    nodes.set(row.id, {
      id: row.id,
      user_id: row.user_id,
      username: row.username,
      avatar_color: row.avatar_color,
      avatar_url: row.avatar_url,
      body: row.body,
      created_at: row.created_at,
      like_count: row.like_count,
      liked: row.liked,
      replies: [],
    });
  }

  const roots: Comment[] = [];
  for (const row of flat) {
    const node = nodes.get(row.id)!;
    if (row.parent_id && nodes.has(row.parent_id)) {
      nodes.get(row.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function countComments(comments: Comment[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + (comment.replies ? countComments(comment.replies) : 0),
    0,
  );
}

function collectCommentIds(comments: Comment[]): string[] {
  const ids: string[] = [];
  for (const comment of comments) {
    ids.push(comment.id);
    if (comment.replies?.length) {
      ids.push(...collectCommentIds(comment.replies));
    }
  }
  return ids;
}

function applyLikeMeta(
  comments: Comment[],
  meta: Map<string, { like_count: number; liked: boolean }>,
): Comment[] {
  return comments.map((comment) => ({
    ...comment,
    like_count: meta.get(comment.id)?.like_count ?? 0,
    liked: meta.get(comment.id)?.liked ?? false,
    replies: comment.replies?.length
      ? applyLikeMeta(comment.replies, meta)
      : comment.replies,
  }));
}

async function getCommentLikeMeta(
  commentIds: string[],
  userId: string | null,
): Promise<Map<string, { like_count: number; liked: boolean }>> {
  const meta = new Map<string, { like_count: number; liked: boolean }>();
  for (const id of commentIds) {
    meta.set(id, { like_count: 0, liked: false });
  }
  if (commentIds.length === 0) return meta;

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) throw error;

  for (const row of (data ?? []) as CommentLikeRow[]) {
    const entry = meta.get(row.comment_id);
    if (!entry) continue;
    entry.like_count += 1;
    if (userId && row.user_id === userId) entry.liked = true;
  }

  return meta;
}

export async function getCommentsForSighting(
  sightingId: string,
  userId: string | null = null,
): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, sighting_id, user_id, parent_id, body, created_at, profiles!user_id(username, avatar_color, avatar_url)",
    )
    .eq("sighting_id", sightingId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const flat = ((data ?? []) as CommentRow[]).map(mapRow);
  const tree = buildCommentTree(flat);
  const meta = await getCommentLikeMeta(collectCommentIds(tree), userId);
  return applyLikeMeta(tree, meta);
}

export async function getCommentCountForSighting(sightingId: string): Promise<number> {
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("sighting_id", sightingId);

  if (error) throw error;
  return count ?? 0;
}

export async function createComment(
  userId: string,
  sightingId: string,
  body: string,
  parentId?: string | null,
): Promise<Comment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");

  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id: userId,
      sighting_id: sightingId,
      parent_id: parentId ?? null,
      body: trimmed,
    })
    .select(
      "id, sighting_id, user_id, parent_id, body, created_at, profiles!user_id(username, avatar_color, avatar_url)",
    )
    .single();

  if (error) throw error;

  const mapped = mapRow(data as CommentRow);
  const { parent_id: _parentId, ...comment } = mapped;
  return comment;
}

export async function setCommentLike(
  userId: string,
  commentId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from("comment_likes")
      .insert({ user_id: userId, comment_id: commentId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("user_id", userId)
      .eq("comment_id", commentId);
    if (error) throw error;
  }
}

export { countComments };

export async function getCommentCountsForSightings(
  sightingIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (sightingIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("comments")
    .select("sighting_id")
    .in("sighting_id", sightingIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const id = row.sighting_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
