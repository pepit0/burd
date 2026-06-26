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

function mapRow(row: CommentRow): Comment & { parent_id: string | null } {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.profiles.username,
    avatar_color: row.profiles.avatar_color,
    avatar_url: row.profiles.avatar_url,
    body: row.body,
    created_at: row.created_at,
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

export async function getCommentsForSighting(sightingId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, sighting_id, user_id, parent_id, body, created_at, profiles!user_id(username, avatar_color, avatar_url)",
    )
    .eq("sighting_id", sightingId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const flat = ((data ?? []) as CommentRow[]).map(mapRow);
  return buildCommentTree(flat);
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

export { countComments };
