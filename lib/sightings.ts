import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { observedDate } from "@/lib/sightingFormat";
import type {
  FeedSighting,
  NewSightingInput,
  Profile,
  Sighting,
} from "@/types";

const RARE_WINDOW_DAYS = 30;

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
  return (data ?? []) as FeedSighting[];
}

export async function getFollowingFeed(): Promise<FeedSighting[]> {
  const { data, error } = await supabase.rpc("following_feed");
  if (error) throw error;
  return (data ?? []) as FeedSighting[];
}

export async function getRareFeed(): Promise<FeedSighting[]> {
  const since = new Date(
    Date.now() - RARE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .eq("rarity", "rare")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FeedSighting[];
}

export async function getMySightings(userId: string): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from("sightings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as Sighting[];
  return rows.sort(
    (a, b) => observedDate(b).getTime() - observedDate(a).getTime(),
  );
}

export async function getFeedPostById(id: string): Promise<FeedSighting | null> {
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as FeedSighting | null;
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
): Promise<void> {
  const { error } = await supabase.from("sightings").insert({
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
    confidence: input.confidence ?? null,
    detected_by: input.detected_by ?? "manual",
  });
  if (error) throw error;
}
