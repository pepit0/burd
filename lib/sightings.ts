import { decode } from "base64-arraybuffer";
import { getMyFollowingIds } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import { observedDate } from "@/lib/sightingFormat";
import type {
  FeedSighting,
  NewSightingInput,
  Profile,
  Sighting,
} from "@/types";

export async function getNearbyFeed(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<FeedSighting[]> {
  const { data, error } = await supabase.rpc("nearby_sightings", {
    in_lat: lat,
    in_lng: lng,
    in_radius_km: radiusKm,
  });
  if (error) throw error;
  return ((data ?? []) as FeedSighting[]).filter((row) => row.published_at);
}

export async function getFollowingFeed(): Promise<FeedSighting[]> {
  const { data, error } = await supabase.rpc("following_feed");
  if (error) throw error;
  return ((data ?? []) as FeedSighting[]).filter((row) => row.published_at);
}

/** Newest sightings worldwide (excluding the current user). */
export async function getGlobalFeed(userId: string): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FeedSighting[];
}

function forYouScore(row: FeedSighting): number {
  const ageHours =
    (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
  const recency = Math.max(0, 72 - ageHours) / 72;
  return row.like_count * 3 + recency * 2 + (row.photo_url ? 0.5 : 0);
}

/** Suggested posts from birders you do not follow yet. */
export async function getForYouFeed(
  userId: string,
  lat: number | null,
  lng: number | null,
  radiusKm: number,
): Promise<FeedSighting[]> {
  const followingIds = await getMyFollowingIds(userId);

  const candidates =
    lat != null && lng != null
      ? await getNearbyFeed(lat, lng, radiusKm * 1.5)
      : await getGlobalFeed(userId);

  return candidates
    .filter(
      (row) => row.user_id !== userId && !followingIds.has(row.user_id),
    )
    .sort((a, b) => forYouScore(b) - forYouScore(a))
    .slice(0, 100);
}

export async function getMySightings(
  userId: string,
  options?: { publishedOnly?: boolean },
): Promise<Sighting[]> {
  let query = supabase
    .from("sightings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (options?.publishedOnly) {
    query = query.not("published_at", "is", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Sighting[];
  return rows.sort(
    (a, b) => observedDate(b).getTime() - observedDate(a).getTime(),
  );
}

export async function publishSighting(
  userId: string,
  sightingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("sightings")
    .update({ published_at: new Date().toISOString() })
    .eq("id", sightingId)
    .eq("user_id", userId)
    .is("published_at", null);
  if (error) throw error;
}

export async function getFeedPostById(id: string): Promise<FeedSighting | null> {
  const sighting = await getSightingById(id);
  if (!sighting) return null;

  const [profileRes, likesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_color, full_name")
      .eq("id", sighting.user_id)
      .maybeSingle(),
    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("sighting_id", id),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (likesRes.error) throw likesRes.error;
  if (!profileRes.data) return null;

  const profile = profileRes.data;

  return {
    ...sighting,
    username: profile.username as string,
    avatar_color: profile.avatar_color as string,
    full_name: (profile.full_name as string | null) ?? null,
    like_count: likesRes.count ?? 0,
  };
}

export async function getSightingById(id: string): Promise<Sighting | null> {
  const { data, error } = await supabase
    .from("sightings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Sighting | null;
}

export async function getMyLikedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("likes")
    .select("sighting_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.sighting_id as string));
}

export async function setLike(
  userId: string,
  sightingId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from("likes")
      .insert({ user_id: userId, sighting_id: sightingId });
    if (error && error.code !== "23505") throw error; // ignore duplicate
  } else {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", userId)
      .eq("sighting_id", sightingId);
    if (error) throw error;
  }
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);
  if (followersRes.error) throw followersRes.error;
  if (followingRes.error) throw followingRes.error;
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

export async function updateSearchRadius(
  userId: string,
  km: number,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ search_radius_km: km })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateProfileAvatarUrl(
  userId: string,
  avatarUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadAvatarPhoto(
  userId: string,
  base64: string,
  ext = "jpg",
): Promise<string> {
  const path = `${userId}/avatar.${ext}`;
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, decode(base64), { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadSightingPhoto(
  userId: string,
  base64: string,
  ext = "jpg",
): Promise<string> {
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const { error } = await supabase.storage
    .from("sightings")
    .upload(path, decode(base64), { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("sightings").getPublicUrl(path);
  return data.publicUrl;
}

export async function createSighting(
  userId: string,
  input: NewSightingInput,
): Promise<string> {
  const { data, error } = await supabase
    .from("sightings")
    .insert({
      user_id: userId,
      species: input.species,
      scientific_name: input.scientific_name ?? null,
      location_name: input.location_name ?? null,
      location_city: input.location_city ?? null,
      location_address: input.location_address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      observed_at: input.observed_at ?? new Date().toISOString(),
      rarity: input.rarity,
      count: input.count,
      notes: input.notes ?? null,
      photo_url: input.photo_url ?? null,
      audio_url: input.audio_url ?? null,
      audio_predictions: input.audio_predictions ?? null,
      confidence: input.confidence ?? null,
      detected_by: input.detected_by ?? "manual",
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
