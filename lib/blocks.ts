import { supabase } from "@/lib/supabase";

export interface BlockedUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  avatar_url: string | null;
  blocked_at: string;
}

export async function blockUser(
  blockedId: string,
  reason = "Blocked by user — reported to Burd moderators",
): Promise<void> {
  const { error } = await supabase.rpc("block_user", {
    p_blocked_id: blockedId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_user", {
    p_blocked_id: blockedId,
  });
  if (error) throw error;
}

export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.blocked_id as string));
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data: blocks, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!blocks?.length) return [];

  const blockedAt = new Map(
    blocks.map((row) => [row.blocked_id as string, row.created_at as string]),
  );
  const ids = [...blockedAt.keys()];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_color, avatar_url")
    .in("id", ids);

  if (profileError) throw profileError;

  return (profiles ?? [])
    .map((profile) => ({
      id: profile.id as string,
      username: profile.username as string,
      full_name: (profile.full_name as string | null) ?? null,
      avatar_color: profile.avatar_color as string,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      blocked_at: blockedAt.get(profile.id as string) ?? new Date().toISOString(),
    }))
    .sort(
      (a, b) => new Date(b.blocked_at).getTime() - new Date(a.blocked_at).getTime(),
    );
}

export function filterBlockedUserIds<T extends { user_id: string }>(
  rows: T[],
  blockedIds: Set<string>,
): T[] {
  if (blockedIds.size === 0) return rows;
  return rows.filter((row) => !blockedIds.has(row.user_id));
}
