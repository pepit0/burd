import { supabase } from "@/lib/supabase";
import { getNearbyFeed } from "@/lib/sightings";
import type { FeedSighting } from "@/types";

export interface UserListItem {
  id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  isFollowing: boolean;
  subtitle?: string | null;
}

export async function getMyFollowingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.following_id as string));
}

function attachFollowing(
  rows: Omit<UserListItem, "isFollowing">[],
  followingIds: Set<string>,
): UserListItem[] {
  return rows.map((row) => ({
    ...row,
    isFollowing: followingIds.has(row.id),
  }));
}

function matchesQuery(item: UserListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.username.toLowerCase().includes(q) ||
    (item.full_name ?? "").toLowerCase().includes(q)
  );
}

function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
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

function birdersFromSightings(
  sightings: FeedSighting[],
  currentUserId: string,
): Omit<UserListItem, "isFollowing">[] {
  const map = new Map<string, Omit<UserListItem, "isFollowing">>();

  for (const row of sightings) {
    if (row.user_id === currentUserId || map.has(row.user_id)) continue;
    map.set(row.user_id, {
      id: row.user_id,
      username: row.username,
      full_name: row.full_name,
      avatar_color: row.avatar_color,
      subtitle: row.location_name ? `Recent post · ${row.location_name}` : "Posted nearby",
    });
  }

  return Array.from(map.values());
}

/** Birders who have posted sightings within your radius. */
export async function getNearbyBirders(
  lat: number,
  lng: number,
  radiusKm: number,
  currentUserId: string,
  query = "",
): Promise<UserListItem[]> {
  const [sightings, profilesRes, followingIds] = await Promise.all([
    getNearbyFeed(lat, lng, radiusKm),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_color, location_name, latitude, longitude")
      .neq("id", currentUserId)
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    getMyFollowingIds(currentUserId),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const map = new Map<string, Omit<UserListItem, "isFollowing">>();

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
    if (existing) continue;

    map.set(profile.id as string, {
      id: profile.id as string,
      username: profile.username as string,
      full_name: (profile.full_name as string | null) ?? null,
      avatar_color: profile.avatar_color as string,
      subtitle: profile.location_name
        ? `${Math.round(distance)} km away · ${profile.location_name}`
        : `${Math.round(distance)} km away`,
    });
  }

  const rows = Array.from(map.values())
    .filter((row) => matchesQuery(row as UserListItem, query))
    .sort((a, b) => a.username.localeCompare(b.username));

  return attachFollowing(rows, followingIds);
}

export async function searchUsers(
  query: string,
  currentUserId: string,
): Promise<UserListItem[]> {
  return searchUsersForMention(query, currentUserId, 50);
}

/** Short list for @mention autocomplete in comments. */
export async function searchUsersForMention(
  query: string,
  currentUserId: string,
  limit = 8,
): Promise<UserListItem[]> {
  const safe = query.trim().replace(/[,()*%:]/g, "");

  let req = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_color, location_name")
    .neq("id", currentUserId)
    .order("username", { ascending: true })
    .limit(limit);

  if (safe.length > 0) {
    req = req.or(`username.ilike.*${safe}*,full_name.ilike.*${safe}*`);
  }

  const { data, error } = await req;
  if (error) throw error;

  const followingIds = await getMyFollowingIds(currentUserId);
  const rows = (data ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    full_name: (p.full_name as string | null) ?? null,
    avatar_color: p.avatar_color as string,
    subtitle: (p.location_name as string | null) ?? null,
  }));

  return attachFollowing(rows, followingIds);
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

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error && error.code !== "23505") throw error;
}

export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}
