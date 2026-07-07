import { supabase } from "@/lib/supabase";
import { getNearbyFeed } from "@/lib/sightings";
import type { FeedSighting } from "@/types";

export type FriendshipStatus = "none" | "outgoing" | "incoming" | "friends";

export interface UserListItem {
  id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  avatar_url?: string | null;
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

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  if (error) throw error;
}

export async function cancelFriendRequest(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_friend_request", {
    target_id: targetId,
  });
  if (!error) return;

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
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", {
    requester_id: requesterId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", {
    requester_id: requesterId,
  });
  if (error) throw error;
}

export async function unfriendUser(friendId: string): Promise<void> {
  const { error } = await supabase.rpc("unfriend", { friend_id: friendId });
  if (error) throw error;
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

function birdersFromSightings(
  sightings: FeedSighting[],
  currentUserId: string,
): Omit<UserListItem, "status">[] {
  const map = new Map<string, Omit<UserListItem, "status">>();

  for (const row of sightings) {
    if (row.user_id === currentUserId || map.has(row.user_id)) continue;
    map.set(row.user_id, {
      id: row.user_id,
      username: row.username,
      full_name: row.full_name,
      avatar_color: row.avatar_color,
      avatar_url: null,
      subtitle: row.location_name
        ? `Recent post · ${row.location_name}`
        : "Posted nearby",
    });
  }

  return Array.from(map.values());
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

/** Birders who have posted sightings within your radius. */
export async function getNearbyBirders(
  lat: number,
  lng: number,
  radiusKm: number,
  currentUserId: string,
  query = "",
): Promise<UserListItem[]> {
  const [sightings, profilesRes, outgoing, incoming] = await Promise.all([
    getNearbyFeed(lat, lng, radiusKm),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_color, avatar_url, location_name, latitude, longitude")
      .neq("id", currentUserId)
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    getOutgoingIds(currentUserId),
    getIncomingIds(currentUserId),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const map = new Map<string, Omit<UserListItem, "status">>();

  for (const row of birdersFromSightings(sightings, currentUserId)) {
    map.set(row.id, row);
  }

  for (const profile of profilesRes.data ?? []) {
    const distance = kmBetween(
      lat,
      lng,
      profile.latitude as number,
      profile.longitude as number,
    );
    if (distance > radiusKm) continue;

    const existing = map.get(profile.id as string);
    if (existing) {
      map.set(profile.id as string, {
        ...existing,
        avatar_url:
          existing.avatar_url ??
          ((profile.avatar_url as string | null) ?? null),
      });
      continue;
    }

    map.set(profile.id as string, {
      id: profile.id as string,
      username: profile.username as string,
      full_name: (profile.full_name as string | null) ?? null,
      avatar_color: profile.avatar_color as string,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      subtitle: profile.location_name
        ? `${Math.round(distance)} km away · ${profile.location_name}`
        : `${Math.round(distance)} km away`,
    });
  }

  // Some nearby candidates are seeded from sightings and may not pass the
  // latitude/longitude profile filter above. Enrich all candidates by id so
  // chosen profile photos still appear.
  const candidateIds = Array.from(map.keys());
  if (candidateIds.length > 0) {
    const enrichRes = await supabase
      .from("profiles")
      .select("id, avatar_url")
      .in("id", candidateIds);

    if (!enrichRes.error) {
      for (const row of enrichRes.data ?? []) {
        const id = row.id as string;
        const existing = map.get(id);
        if (!existing) continue;
        map.set(id, {
          ...existing,
          avatar_url:
            existing.avatar_url ?? ((row.avatar_url as string | null) ?? null),
        });
      }
    }
  }

  const base = Array.from(map.values())
    .filter((row) => matchesQuery(row, query))
    .sort((a, b) => a.username.localeCompare(b.username));

  return attachStatus(base, outgoing, incoming);
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
    .select("id, username, full_name, avatar_color, avatar_url, location_name")
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
    .select("id, username, full_name, avatar_color, avatar_url, location_name")
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
    .select("id, username, full_name, avatar_color, avatar_url, location_name")
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
