import { decode } from "base64-arraybuffer";
import { getCommentCountsForSightings } from "@/lib/comments";
import { getMyFriendIds } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import { journalLogDate } from "@/lib/sightingFormat";
import type {
  FeedSighting,
  JournalSightingUpdate,
  NewSightingInput,
  Profile,
  PublishedPostUpdate,
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

async function getMyPublishedFeedRows(userId: string): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .eq("user_id", userId)
    .not("published_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FeedSighting[];
}

function mergeFeedRows(...lists: FeedSighting[][]): FeedSighting[] {
  const byId = new Map<string, FeedSighting>();
  for (const list of lists) {
    for (const row of list) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getFollowingFeed(userId: string): Promise<FeedSighting[]> {
  const [{ data, error }, ownRows] = await Promise.all([
    supabase.rpc("following_feed"),
    getMyPublishedFeedRows(userId),
  ]);
  if (error) throw error;
  const friendRows = ((data ?? []) as FeedSighting[]).filter((row) => row.published_at);
  const rows = mergeFeedRows(friendRows, ownRows).slice(0, 100);
  return withCommentCounts(rows);
}

/** Newest published sightings worldwide. */
export async function getGlobalFeed(): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .not("published_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return withCommentCounts((data ?? []) as FeedSighting[]);
}

async function withCommentCounts(rows: FeedSighting[]): Promise<FeedSighting[]> {
  const counts = await getCommentCountsForSightings(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    comment_count: counts.get(row.id) ?? 0,
  }));
}

function forYouScore(row: FeedSighting): number {
  const ageHours =
    (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
  const recency = Math.max(0, 72 - ageHours) / 72;
  return row.like_count * 3 + recency * 2 + (row.photo_url ? 0.5 : 0);
}

function rankForYouCandidates(
  candidates: FeedSighting[],
  friendIds: Set<string>,
): FeedSighting[] {
  return candidates
    .filter((row) => !friendIds.has(row.user_id))
    .sort((a, b) => forYouScore(b) - forYouScore(a))
    .slice(0, 100);
}

/** Nearby and suggested posts, including your own published sightings. */
export async function getForYouFeed(
  userId: string,
  lat: number | null,
  lng: number | null,
  radiusKm: number,
): Promise<FeedSighting[]> {
  const friendIds = await getMyFriendIds(userId);
  const ownRows = await getMyPublishedFeedRows(userId);

  let candidates = mergeFeedRows(
    lat != null && lng != null
      ? await getNearbyFeed(lat, lng, radiusKm * 1.5)
      : await getGlobalFeed(),
    ownRows,
  );

  let filtered = rankForYouCandidates(candidates, friendIds);

  // Nearby can be sparse — keep showing suggestions instead of an empty feed.
  if (filtered.length === 0 && lat != null && lng != null) {
    candidates = mergeFeedRows(await getGlobalFeed(), ownRows);
    filtered = rankForYouCandidates(candidates, friendIds);
  }

  return withCommentCounts(filtered);
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
  const rows = ((data ?? []) as Sighting[]).filter((row) => row.user_id === userId);
  return rows.sort(
    (a, b) => journalLogDate(b).getTime() - journalLogDate(a).getTime(),
  );
}

export async function publishSighting(
  userId: string,
  sightingId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("sightings")
    .update({ published_at: new Date().toISOString() })
    .eq("id", sightingId)
    .eq("user_id", userId)
    .is("published_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("This sighting is already posted to your profile.");
  }
}

/** Remove from profile/feed while keeping the journal entry. */
export async function unpublishSighting(
  userId: string,
  sightingId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("sightings")
    .update({ published_at: null })
    .eq("id", sightingId)
    .eq("user_id", userId)
    .not("published_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("This sighting is not on your profile.");
  }
}

export async function updateMyJournalSighting(
  userId: string,
  sightingId: string,
  input: JournalSightingUpdate,
): Promise<void> {
  const { data, error } = await supabase
    .from("sightings")
    .update({
      species: input.species,
      scientific_name: input.scientific_name ?? null,
      location_name: input.location_name ?? null,
      location_city: input.location_city ?? null,
      location_address: input.location_address ?? null,
      observed_at: input.observed_at ?? null,
      rarity: input.rarity,
      count: input.count,
      notes: input.notes ?? null,
    })
    .eq("id", sightingId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("This sighting could not be updated.");
  }
}

export async function updateMyPublishedPost(
  _userId: string,
  sightingId: string,
  input: PublishedPostUpdate,
): Promise<void> {
  const { error } = await supabase.rpc("update_my_published_post", {
    p_sighting_id: sightingId,
    p_notes: input.notes ?? "",
  });
  if (error) throw error;
}

export async function getFeedPostById(id: string): Promise<FeedSighting | null> {
  const sighting = await getSightingById(id);
  if (!sighting) return null;

  const [profileRes, likesRes, repostsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_color, full_name, avatar_url")
      .eq("id", sighting.user_id)
      .maybeSingle(),
    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("sighting_id", id),
    supabase
      .from("reposts")
      .select("*", { count: "exact", head: true })
      .eq("sighting_id", id),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (likesRes.error) throw likesRes.error;
  if (repostsRes.error) throw repostsRes.error;
  if (!profileRes.data) return null;

  const profile = profileRes.data;
  const commentCounts = await getCommentCountsForSightings([id]);

  return {
    ...sighting,
    username: profile.username as string,
    avatar_color: profile.avatar_color as string,
    avatar_url: (profile.avatar_url as string | null) ?? null,
    full_name: (profile.full_name as string | null) ?? null,
    like_count: likesRes.count ?? 0,
    repost_count: repostsRes.count ?? 0,
    comment_count: commentCounts.get(id) ?? 0,
  };
}

export async function deleteMySighting(userId: string, sightingId: string): Promise<void> {
  const { data, error } = await supabase
    .from("sightings")
    .delete()
    .eq("id", sightingId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("You can only delete sightings from your own journal.");
  }
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

export async function getMyRepostedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("reposts")
    .select("sighting_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.sighting_id as string));
}

export async function setRepost(
  userId: string,
  sightingId: string,
  reposted: boolean,
): Promise<void> {
  if (reposted) {
    const sighting = await getSightingById(sightingId);
    if (!sighting) {
      throw new Error("Post not found.");
    }
    if (sighting.user_id === userId) {
      throw new Error("You can't repost your own sightings.");
    }
    if (!sighting.published_at || sighting.removed_at) {
      throw new Error("This post can't be reposted.");
    }

    const { error } = await supabase
      .from("reposts")
      .insert({ user_id: userId, sighting_id: sightingId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("reposts")
      .delete()
      .eq("user_id", userId)
      .eq("sighting_id", sightingId);
    if (error) throw error;
  }
}

/** Profile reposts only — never creates or returns journal entries for the reposter. */
export async function getRepostedSightings(userId: string): Promise<Sighting[]> {
  const { data: repostRows, error: repostError } = await supabase
    .from("reposts")
    .select("sighting_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (repostError) throw repostError;

  const orderedIds = (repostRows ?? []).map((row) => row.sighting_id as string);
  if (orderedIds.length === 0) return [];

  const { data: sightings, error: sightingError } = await supabase
    .from("sightings")
    .select("*")
    .in("id", orderedIds)
    .not("published_at", "is", null)
    .is("removed_at", null);
  if (sightingError) throw sightingError;

  const byId = new Map(
    ((sightings ?? []) as Sighting[]).map((row) => [row.id, row]),
  );

  return orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is Sighting => row != null);
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

export async function updateLikeIconStyle(
  userId: string,
  style: Profile["like_icon_style"],
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ like_icon_style: style ?? "heart" })
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

export interface ProfileDetailsUpdate {
  full_name?: string | null;
  bio?: string | null;
  cover_url?: string | null;
}

export async function updateProfileDetails(
  userId: string,
  fields: ProfileDetailsUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(fields)
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
