import { supabase } from "@/lib/supabase";
import { clearFriendRequestActivity } from "@/lib/activity";
import { emitFriendshipChange } from "@/lib/friendshipEvents";

/** Fixed discovery radius for Find Birders → Nearby (independent of feed radius). */
export const NEARBY_BIRDERS_RADIUS_KM = 100;
export type FriendshipStatus = "none" | "outgoing" | "incoming" | "friends";

export interface UserListItem {
  id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  avatar_url?: string | null;
  is_verified?: boolean;
  is_beta?: boolean;
  status: FriendshipStatus;
  subtitle?: string | null;
}

function normalizeSearchTerm(query: string): string {
  return query.trim().replace(/^@+/, "").toLowerCase();
}

function relevanceScore(
  item: Pick<UserListItem, "username" | "full_name">,
  rawQuery: string,
): number {
  const q = normalizeSearchTerm(rawQuery);
  if (!q) return 0;
  const username = item.username.toLowerCase();
  const fullName = (item.full_name ?? "").toLowerCase();
  if (username === q) return 100;
  if (username.startsWith(q)) return 80;
  if (fullName === q) return 70;
  if (fullName.startsWith(q)) return 60;
  if (username.includes(q)) return 40;
  if (fullName.includes(q)) return 30;
  return 0;
}

function matchesQuery(item: { username: string; full_name: string | null }, query: string): boolean {
  const q = normalizeSearchTerm(query);
  if (!q) return true;
  return (
    item.username.toLowerCase().includes(q) ||
    (item.full_name ?? "").toLowerCase().includes(q)
  );
}

async function getOutgoingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.following_id as string));
}

async function getIncomingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.follower_id as string));
}

export async function getMyFriendIds(userId: string): Promise<Set<string>> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(userId),
    getIncomingIds(userId),
  ]);
  const friends = new Set<string>();
  for (const id of outgoing) {
    if (incoming.has(id)) friends.add(id);
  }
  return friends;
}

export async function getFriendshipStatus(
  currentUserId: string,
  targetId: string,
): Promise<FriendshipStatus> {
  const [{ data: out }, { data: inc }] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", targetId)
      .eq("following_id", currentUserId)
      .maybeSingle(),
  ]);
  const hasOut = Boolean(out);
  const hasIn = Boolean(inc);
  if (hasOut && hasIn) return "friends";
  if (hasOut) return "outgoing";
  if (hasIn) return "incoming";
  return "none";
}

export async function sendFriendRequest(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("send_friend_request", {
    target_id: targetId,
  });
  if (!error) {
    emitFriendshipChange({ targetUserId: targetId, status: "outgoing" });
    return;
  }

  // Fallback when RPC grants are missing: direct insert is allowed by follows RLS.
  const authRes = await supabase.auth.getUser();
  const currentUserId = authRes.data.user?.id ?? null;
  if (!currentUserId) throw error;

  const direct = await supabase.from("follows").insert({
    follower_id: currentUserId,
    following_id: targetId,
  });

  if (direct.error && direct.error.code !== "23505") throw error;
  emitFriendshipChange({ targetUserId: targetId, status: "outgoing" });
}

export async function cancelFriendRequest(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_friend_request", {
    target_id: targetId,
  });
  if (!error) {
    emitFriendshipChange({ targetUserId: targetId, status: "none" });
    return;
  }

  // Fallback path: if RPC fails for any reason, try direct delete for current user.
  const authRes = await supabase.auth.getUser();
  const currentUserId = authRes.data.user?.id ?? null;
  if (!currentUserId) throw error;

  const direct = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", currentUserId)
    .eq("following_id", targetId);

  if (direct.error) throw error;
  emitFriendshipChange({ targetUserId: targetId, status: "none" });
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", {
    requester_id: requesterId,
  });
  if (!error) {
    await clearFriendRequestActivity(requesterId);
    emitFriendshipChange({ targetUserId: requesterId, status: "friends" });
    return;
  }

  const authRes = await supabase.auth.getUser();
  const currentUserId = authRes.data.user?.id ?? null;
  if (!currentUserId) throw error;

  const { data: incoming } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", requesterId)
    .eq("following_id", currentUserId)
    .maybeSingle();

  if (!incoming) throw error;

  const direct = await supabase.from("follows").insert({
    follower_id: currentUserId,
    following_id: requesterId,
  });

  if (direct.error && direct.error.code !== "23505") throw error;
  await clearFriendRequestActivity(requesterId);
  emitFriendshipChange({ targetUserId: requesterId, status: "friends" });
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", {
    requester_id: requesterId,
  });
  if (error) throw error;
  await clearFriendRequestActivity(requesterId);
  emitFriendshipChange({ targetUserId: requesterId, status: "none" });
}

export async function unfriendUser(friendId: string): Promise<void> {
  const { error } = await supabase.rpc("unfriend", { friend_id: friendId });
  if (error) throw error;
  emitFriendshipChange({ targetUserId: friendId, status: "none" });
}

function statusForId(
  targetId: string,
  outgoing: Set<string>,
  incoming: Set<string>,
): FriendshipStatus {
  const hasOut = outgoing.has(targetId);
  const hasIn = incoming.has(targetId);
  if (hasOut && hasIn) return "friends";
  if (hasOut) return "outgoing";
  if (hasIn) return "incoming";
  return "none";
}

interface NearbyBirderRow {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_beta: boolean;
  location_name: string | null;
  distance_km: number;
}

function nearbyBirderSubtitle(row: NearbyBirderRow): string {
  const distance = `${Math.round(row.distance_km)} km away`;
  return row.location_name
    ? `Recent post · ${row.location_name} · ${distance}`
    : `Recent post · ${distance}`;
}

function attachStatus(
  rows: Omit<UserListItem, "status">[],
  outgoing: Set<string>,
  incoming: Set<string>,
): UserListItem[] {
  return rows.map((row) => ({
    ...row,
    status: statusForId(row.id, outgoing, incoming),
  }));
}

/** Birders whose latest published post is within radius of you. */
export async function getNearbyBirders(
  lat: number,
  lng: number,
  radiusKm: number | null,
  currentUserId: string,
  query = "",
): Promise<UserListItem[]> {
  const effectiveRadius = radiusKm ?? NEARBY_BIRDERS_RADIUS_KM;

  const [birdersRes, outgoing, incoming] = await Promise.all([
    supabase.rpc("nearby_birders", {
      in_lat: lat,
      in_lng: lng,
      in_radius_km: effectiveRadius,
    }),
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);

  if (birdersRes.error) throw birdersRes.error;

  const rows = ((birdersRes.data ?? []) as NearbyBirderRow[])
    .map((row) => ({
      id: row.user_id,
      username: row.username,
      full_name: row.full_name,
      avatar_color: row.avatar_color,
      avatar_url: row.avatar_url,
      is_verified: Boolean(row.is_verified),
      is_beta: Boolean(row.is_beta),
      subtitle: nearbyBirderSubtitle(row),
    }))
    .filter((row) => matchesQuery(row, query))
    .sort((a, b) => a.username.localeCompare(b.username));

  return attachStatus(rows, outgoing, incoming);
}

export async function searchUsers(
  query: string,
  currentUserId: string,
): Promise<UserListItem[]> {
  return searchUsersForMention(query, currentUserId, 50);
}

export async function searchUsersForAdmin(
  query: string,
  currentUserId: string,
  options?: { includeSelf?: boolean; limit?: number },
): Promise<UserListItem[]> {
  const includeSelf = options?.includeSelf ?? true;
  const limit = options?.limit ?? 50;
  const safe = normalizeSearchTerm(query).replace(/[,()*%:]/g, "");

  let req = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_color, avatar_url, location_name, is_verified, is_beta")
    .order("username", { ascending: true })
    .limit(limit);

  if (!includeSelf) {
    req = req.neq("id", currentUserId);
  }

  if (safe.length > 0) {
    req = req.or(`username.ilike.*${safe}*,full_name.ilike.*${safe}*`);
  }

  const { data, error } = await req;
  if (error) throw error;

  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);

  const rows = (data ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    full_name: (p.full_name as string | null) ?? null,
    avatar_color: p.avatar_color as string,
    avatar_url: (p.avatar_url as string | null) ?? null,
    is_verified: Boolean(p.is_verified),
    is_beta: Boolean(p.is_beta),
    subtitle: (p.location_name as string | null) ?? null,
  }));

  return attachStatus(rows, outgoing, incoming).sort((a, b) => {
    const byScore = relevanceScore(b, query) - relevanceScore(a, query);
    if (byScore !== 0) return byScore;
    return a.username.localeCompare(b.username);
  });
}

/** Short list for @mention autocomplete in comments. */
export async function searchUsersForMention(
  query: string,
  currentUserId: string,
  limit = 8,
): Promise<UserListItem[]> {
  const safe = normalizeSearchTerm(query).replace(/[,()*%:]/g, "");

  let req = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_color, avatar_url, location_name, is_verified, is_beta")
    .neq("id", currentUserId)
    .order("username", { ascending: true })
    .limit(limit);

  if (safe.length > 0) {
    req = req.or(`username.ilike.*${safe}*,full_name.ilike.*${safe}*`);
  }

  const { data, error } = await req;
  if (error) throw error;

  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);

  const rows = (data ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    full_name: (p.full_name as string | null) ?? null,
    avatar_color: p.avatar_color as string,
    avatar_url: (p.avatar_url as string | null) ?? null,
    is_verified: Boolean(p.is_verified),
    is_beta: Boolean(p.is_beta),
    subtitle: (p.location_name as string | null) ?? null,
  }));

  return attachStatus(rows, outgoing, incoming).sort((a, b) => {
    const byScore = relevanceScore(b, query) - relevanceScore(a, query);
    if (byScore !== 0) return byScore;
    return a.username.localeCompare(b.username);
  });
}

export async function getUserIdByUsername(username: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

async function profilesForIds(
  ids: string[],
): Promise<
  Array<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_color: string;
    avatar_url: string | null;
    subtitle: string | null;
  }>
> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_color, avatar_url, location_name, is_verified, is_beta")
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((p) => [p.id as string, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      id: p.id as string,
      username: p.username as string,
      full_name: (p.full_name as string | null) ?? null,
      avatar_color: p.avatar_color as string,
      avatar_url: (p.avatar_url as string | null) ?? null,
      is_verified: Boolean(p.is_verified),
      is_beta: Boolean(p.is_beta),
      subtitle: (p.location_name as string | null) ?? null,
    }));
}

export async function getFriendCounts(
  userId: string,
): Promise<{ friends: number; incoming: number; outgoing: number }> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(userId),
    getIncomingIds(userId),
  ]);
  let friends = 0;
  let outgoingReq = 0;
  let incomingReq = 0;
  for (const id of outgoing) {
    if (incoming.has(id)) friends++;
    else outgoingReq++;
  }
  for (const id of incoming) {
    if (!outgoing.has(id)) incomingReq++;
  }
  return { friends, incoming: incomingReq, outgoing: outgoingReq };
}

export async function getFriendsList(
  profileUserId: string,
  currentUserId: string,
): Promise<UserListItem[]> {
  const [profileOutgoing, profileIncoming, currentOutgoing, currentIncoming] =
    await Promise.all([
      getOutgoingIds(profileUserId),
      getIncomingIds(profileUserId),
      getOutgoingIds(currentUserId),
      getIncomingIds(currentUserId),
    ]);

  const friendIds: string[] = [];
  for (const id of profileOutgoing) {
    if (profileIncoming.has(id)) friendIds.push(id);
  }

  const profiles = await profilesForIds(friendIds);
  return profiles.map((p) => ({
    ...p,
    status: statusForId(p.id, currentOutgoing, currentIncoming),
  }));
}

export async function getIncomingFriendRequests(
  currentUserId: string,
): Promise<UserListItem[]> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);
  const requesters = [...incoming].filter((id) => !outgoing.has(id));
  const profiles = await profilesForIds(requesters);
  return profiles.map((p) => ({ ...p, status: "incoming" }));
}

export async function getOutgoingFriendRequests(
  currentUserId: string,
): Promise<UserListItem[]> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);
  const targets = [...outgoing].filter((id) => !incoming.has(id));
  const profiles = await profilesForIds(targets);
  return profiles.map((p) => ({ ...p, status: "outgoing" }));
}
