import { decode } from "base64-arraybuffer";
import { getCommentCountsForSightings } from "@/lib/comments";
import { redactSightingLocation, redactSightingLocations } from "@/lib/locationPrivacy";
import { effectiveLocationPolicy } from "@/lib/privacySettings";
import { profilePrivacyDefaults } from "@/lib/profilePreferences";
import { lookupRegionalRarity } from "@/lib/rarity";
import { getMyFriendIds } from "@/lib/social";
import { supabase } from "@/lib/supabase";
import { journalLogDate, postedDate } from "@/lib/sightingFormat";
import type { PostAudioTrim } from "@/lib/sightingAudio";
import { getSightingPhotos, insertSightingPhotos, isSightingPhotosSchemaMissing, sightingPhotosForDisplay } from "@/lib/sightingPhotos";
import { insertSightingCompanions, getSightingCompanions, getSightingCompanionsForSightings } from "@/lib/sightingCompanions";
import { getAudioSourceAttribution, getAudioSourceAttributions } from "@/lib/friendSounds";
import type {
  FeedSighting,
  JournalSightingUpdate,
  NewSightingInput,
  Profile,
  PublishedPostUpdate,
  Sighting,
  SightingMediaUpdate,
  SightingVisibility,
} from "@/types";

export async function getNearbyFeed(
  lat: number,
  lng: number,
  radiusKm: number | null,
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
    .order("published_at", { ascending: false })
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
    (a, b) => postedDate(b).getTime() - postedDate(a).getTime(),
  );
}

export async function getFollowingFeed(userId: string): Promise<FeedSighting[]> {
  const friendIds = await getMyFriendIds(userId);
  const rows = await fetchSocialFeedRows([...friendIds], 100);
  return withCommentCounts(rows);
}

/** Home feed: all recent public posts worldwide, including yours and friends. */
export async function getForYouFeed(
  userId: string,
  lat: number | null,
  lng: number | null,
  radiusKm: number | null,
): Promise<FeedSighting[]> {
  const [globalRows, ownRows, nearbyRows] = await Promise.all([
    fetchGlobalFeedRows(),
    getMyPublishedFeedRows(userId),
    lat != null && lng != null
      ? getNearbyFeed(lat, lng, radiusKm != null ? radiusKm * 1.5 : null)
      : Promise.resolve([] as FeedSighting[]),
  ]);

  const rows = sortFeedNewestFirst(
    mergeFeedRows(globalRows, nearbyRows, ownRows),
  ).slice(0, 100);

  return withCommentCounts(rows);
}

async function fetchSocialFeedRows(
  authorIds: string[],
  limit: number,
): Promise<FeedSighting[]> {
  const uniqueAuthorIds = [...new Set(authorIds.filter(Boolean))];
  if (uniqueAuthorIds.length === 0) return [];

  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .in("user_id", uniqueAuthorIds)
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit * 2, 100), 300));

  if (error) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("following_feed");
    if (rpcError) throw rpcError;
    const allowed = new Set(uniqueAuthorIds);
    return sortFeedNewestFirst(
      ((rpcData ?? []) as FeedSighting[]).filter(
        (row) => row.published_at && allowed.has(row.user_id),
      ),
    ).slice(0, limit);
  }

  return sortFeedNewestFirst((data ?? []) as FeedSighting[]).slice(0, limit);
}

/** Newest published sightings worldwide (raw rows). */
async function fetchGlobalFeedRows(): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from("sighting_feed")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FeedSighting[];
}

/** Newest published sightings worldwide. */
export async function getGlobalFeed(): Promise<FeedSighting[]> {
  return withCommentCounts(await fetchGlobalFeedRows());
}

/** Search published posts by hashtag (exact, prefix, or partial tag match). */
export async function searchFeedByHashtag(query: string): Promise<FeedSighting[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_sightings_by_hashtag", {
    p_query: q,
  });
  if (error) throw error;
  return withCommentCounts((data ?? []) as FeedSighting[]);
}

async function getViewerUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function withCommentCounts(rows: FeedSighting[]): Promise<FeedSighting[]> {
  const viewerUserId = await getViewerUserId();
  const counts = await getCommentCountsForSightings(rows.map((row) => row.id));
  const withCounts = rows.map((row) => ({
    ...row,
    comment_count: counts.get(row.id) ?? 0,
  }));
  const redacted = await redactSightingLocations(withCounts, viewerUserId);
  return enrichSightingsWithSocialFields(redacted);
}

function sortFeedNewestFirst(rows: FeedSighting[]): FeedSighting[] {
  return [...rows].sort(
    (a, b) => postedDate(b).getTime() - postedDate(a).getTime(),
  );
}

/** Discovery feed: global posts (e.g. explore surfaces). */
export async function getDiscoveryFeed(
  userId: string,
  lat: number | null,
  lng: number | null,
  radiusKm: number | null,
): Promise<FeedSighting[]> {
  const friendIds = await getMyFriendIds(userId);

  const [ownRows, globalRows, nearbyRows] = await Promise.all([
    getMyPublishedFeedRows(userId),
    fetchGlobalFeedRows(),
    lat != null && lng != null
      ? getNearbyFeed(lat, lng, radiusKm != null ? radiusKm * 1.5 : null)
      : Promise.resolve([] as FeedSighting[]),
  ]);

  const filtered = sortFeedNewestFirst(
    mergeFeedRows(globalRows, nearbyRows, ownRows).filter(
      (row) => !friendIds.has(row.user_id),
    ),
  ).slice(0, 100);

  return withCommentCounts(filtered);
}

async function enrichSightingsWithSocialFields<T extends Sighting>(
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;

  const sightingIds = rows.map((row) => row.id);
  const sourceIds = [
    ...new Set(
      rows
        .map((row) => row.audio_source_sighting_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [companionsBySighting, sourcesById] = await Promise.all([
    getSightingCompanionsForSightings(sightingIds),
    getAudioSourceAttributions(sourceIds),
  ]);

  return rows.map((row) => ({
    ...row,
    companions: companionsBySighting.get(row.id) ?? [],
    audio_source: row.audio_source_sighting_id
      ? sourcesById.get(row.audio_source_sighting_id) ?? null
      : null,
  }));
}

async function enrichSightingWithSocialFields<T extends Sighting>(
  row: T,
): Promise<T> {
  const [companions, audioSource] = await Promise.all([
    getSightingCompanions(row.id),
    row.audio_source_sighting_id
      ? getAudioSourceAttribution(row.audio_source_sighting_id)
      : Promise.resolve(null),
  ]);

  return {
    ...row,
    companions,
    audio_source: audioSource,
  };
}

export async function getMySightings(
  userId: string,
  options?: { publishedOnly?: boolean; viewerUserId?: string | null },
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
  const sorted = rows.sort((a, b) => {
    if (options?.publishedOnly) {
      return postedDate(b).getTime() - postedDate(a).getTime();
    }
    return journalLogDate(b).getTime() - journalLogDate(a).getTime();
  });
  const viewerUserId = options?.viewerUserId ?? userId;
  return redactSightingLocations(sorted, viewerUserId);
}

export async function publishSighting(
  userId: string,
  sightingId: string,
  options?: {
    visibility?: SightingVisibility;
    audioTrim?: PostAudioTrim | null;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    published_at: new Date().toISOString(),
    published_audio_start_ms: options?.audioTrim?.startMs ?? null,
    published_audio_end_ms: options?.audioTrim?.endMs ?? null,
  };
  if (options?.visibility) {
    update.visibility = options.visibility;
  }
  const { data, error } = await supabase
    .from("sightings")
    .update(update)
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
    .update({
      published_at: null,
      published_audio_start_ms: null,
      published_audio_end_ms: null,
    })
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
  _userId: string,
  sightingId: string,
  input: JournalSightingUpdate,
): Promise<void> {
  const payload = {
    p_sighting_id: sightingId,
    p_species: input.species,
    p_scientific_name: input.scientific_name ?? "",
    p_notes: input.notes ?? "",
    p_location_name: input.location_name ?? "",
    p_location_city: input.location_city ?? "",
    p_location_address: input.location_address ?? "",
    p_observed_at: input.observed_at ?? null,
    p_rarity: input.rarity,
    p_count: input.count,
    p_photo_url: input.photo_url ?? null,
  };

  let { error } = await supabase.rpc("update_my_journal_sighting", payload);
  if (error && input.photo_url && isSightingPhotosSchemaMissing(error)) {
    const { p_photo_url: _photoUrl, ...legacyPayload } = payload;
    ({ error } = await supabase.rpc("update_my_journal_sighting", legacyPayload));
  }
  if (error) throw error;
}

export async function updateSightingMedia(
  userId: string,
  sightingId: string,
  input: SightingMediaUpdate,
): Promise<void> {
  const update: Record<string, unknown> = {};

  if (input.photo_url !== undefined) update.photo_url = input.photo_url;
  if (input.photo_count !== undefined) update.photo_count = input.photo_count;
  if (input.audio_url !== undefined) update.audio_url = input.audio_url;
  if (input.audio_predictions !== undefined) {
    update.audio_predictions = input.audio_predictions;
  }
  if (input.audio_source_sighting_id !== undefined) {
    update.audio_source_sighting_id = input.audio_source_sighting_id;
  }
  if (input.published_audio_start_ms !== undefined) {
    update.published_audio_start_ms = input.published_audio_start_ms;
  }
  if (input.published_audio_end_ms !== undefined) {
    update.published_audio_end_ms = input.published_audio_end_ms;
  }

  if (Object.keys(update).length === 0) return;

  let result = await supabase
    .from("sightings")
    .update(update)
    .eq("id", sightingId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (result.error && isSightingPhotosSchemaMissing(result.error)) {
    const { photo_count: _photoCount, ...legacyUpdate } = update;
    result = await supabase
      .from("sightings")
      .update(legacyUpdate)
      .eq("id", sightingId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
  }

  if (result.error) throw result.error;
  if (!result.data) {
    throw new Error("Sighting not found or not editable.");
  }
}

function speciesIdentityChanged(
  before: { species: string; scientific_name: string | null },
  after: { species: string; scientific_name: string | null },
): boolean {
  const beforeSpecies = before.species.trim().toLowerCase();
  const afterSpecies = after.species.trim().toLowerCase();
  const beforeScientific = (before.scientific_name ?? "").trim().toLowerCase();
  const afterScientific = (after.scientific_name ?? "").trim().toLowerCase();
  return beforeSpecies !== afterSpecies || beforeScientific !== afterScientific;
}

async function syncJournalSpeciesMetadata(
  sighting: Sighting,
  species: string,
  scientific_name: string | null,
  speciesChanged: boolean,
): Promise<void> {
  if (!speciesChanged) return;

  const trimmedSpecies = species.trim();
  const trimmedScientific = scientific_name?.trim() || null;
  const clearAiIdentification = sighting.detected_by !== "manual";

  if (clearAiIdentification) {
    const { error } = await supabase
      .from("sightings")
      .update({ detected_by: "manual", confidence: null })
      .eq("id", sighting.id)
      .eq("user_id", sighting.user_id);
    if (error) throw error;
  }

  const { error: photoError } = await supabase
    .from("sighting_photos")
    .update({
      species: trimmedSpecies,
      scientific_name: trimmedScientific,
      ...(clearAiIdentification
        ? { detected_by: "manual", confidence: null }
        : null),
    })
    .eq("sighting_id", sighting.id);

  if (photoError && !isSightingPhotosSchemaMissing(photoError)) {
    throw photoError;
  }
}

/** Clear AI identification metadata when the owner corrects species. */
export async function applyJournalSpeciesCorrection(
  sighting: Sighting,
  species: string,
  scientific_name: string | null,
): Promise<void> {
  const speciesChanged = speciesIdentityChanged(
    {
      species: sighting.species,
      scientific_name: sighting.scientific_name,
    },
    { species: species.trim(), scientific_name: scientific_name?.trim() || null },
  );

  await syncJournalSpeciesMetadata(
    sighting,
    species.trim(),
    scientific_name?.trim() || null,
    speciesChanged,
  );
}

/** Update species on a journal entry and clear stale AI metadata when corrected. */
export async function correctJournalSightingSpecies(
  sighting: Sighting,
  species: string,
  scientific_name: string | null,
): Promise<Sighting> {
  const trimmedSpecies = species.trim();
  const trimmedScientific = scientific_name?.trim() || null;
  const speciesChanged = speciesIdentityChanged(
    {
      species: sighting.species,
      scientific_name: sighting.scientific_name,
    },
    { species: trimmedSpecies, scientific_name: trimmedScientific },
  );

  const rarity = lookupRegionalRarity({
    species: trimmedSpecies,
    scientificName: trimmedScientific,
    lat: sighting.latitude,
    lng: sighting.longitude,
    observedAt: sighting.observed_at,
  });

  await updateMyJournalSighting(sighting.user_id, sighting.id, {
    species: trimmedSpecies,
    scientific_name: trimmedScientific,
    notes: sighting.notes,
    location_name: sighting.location_name,
    location_city: sighting.location_city,
    location_address: sighting.location_address,
    observed_at: sighting.observed_at,
    rarity,
    count: sighting.count,
  });

  await syncJournalSpeciesMetadata(
    sighting,
    trimmedSpecies,
    trimmedScientific,
    speciesChanged,
  );

  const updated = await getSightingById(sighting.id);
  if (!updated) {
    throw new Error("Sighting not found after update.");
  }
  return updated;
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
    photos: sighting.photos,
    photo_count: sighting.photo_count,
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
  if (!data) return null;
  const viewerUserId = await getViewerUserId();
  const sighting = await redactSightingLocation(data as Sighting, viewerUserId);

  let photos: Sighting["photos"] = [];
  try {
    photos = await getSightingPhotos(id);
  } catch {
    photos = [];
  }

  const displayPhotos =
    photos.length > 0 ? photos : sighting.photo_url ? sightingPhotosForDisplay(sighting) : [];

  return enrichSightingWithSocialFields({
    ...sighting,
    photos: displayPhotos,
    photo_count:
      displayPhotos.length > 0
        ? displayPhotos.length
        : sighting.photo_count ?? (sighting.photo_url ? 1 : 0),
  });
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

  const rows = orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is Sighting => row != null);

  const viewerUserId = await getViewerUserId();
  return redactSightingLocations(rows, viewerUserId);
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
  km: number | null,
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
  showcase_badge_ids?: string[];
}

export async function updateProfileShowcaseBadges(
  userId: string,
  badgeIds: string[],
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ showcase_badge_ids: badgeIds })
    .eq("id", userId);
  if (error) throw error;
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

export async function updateSightingPrivacy(
  userId: string,
  sightingId: string,
  fields: {
    visibility?: SightingVisibility;
    share_exact_coordinates?: boolean;
    location_fuzz_km?: number;
  },
  profile?: Profile | null,
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("sightings")
    .select("*")
    .eq("id", sightingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing) throw new Error("Sighting not found.");

  const sighting = existing as Sighting;
  const defaults = profilePrivacyDefaults(profile ?? null);
  const shareExact =
    fields.share_exact_coordinates ??
    sighting.share_exact_coordinates ??
    defaults.shareExactCoordinates;
  const fuzzKm =
    fields.location_fuzz_km ?? sighting.location_fuzz_km ?? defaults.locationFuzzKm;

  const policy = effectiveLocationPolicy({
    latitude: sighting.latitude,
    longitude: sighting.longitude,
    shareExactCoordinates: shareExact,
    locationFuzzKm: fuzzKm,
    scientificName: sighting.scientific_name,
    species: sighting.species,
  });

  const { error } = await supabase
    .from("sightings")
    .update({
      ...fields,
      public_latitude: policy.publicLatitude,
      public_longitude: policy.publicLongitude,
      location_obscured_reason: policy.locationObscuredReason,
    })
    .eq("id", sightingId)
    .eq("user_id", userId);
  if (error) throw error;
}

function buildLocationFields(
  input: NewSightingInput,
  profile: Profile | null,
): {
  public_latitude: number | null;
  public_longitude: number | null;
  location_obscured_reason: Sighting["location_obscured_reason"];
  share_exact_coordinates: boolean;
  location_fuzz_km: number;
  visibility: SightingVisibility | null;
} {
  const defaults = profilePrivacyDefaults(profile);
  const shareExact = input.share_exact_coordinates ?? defaults.shareExactCoordinates;
  const fuzzKm = input.location_fuzz_km ?? defaults.locationFuzzKm;
  const policy = effectiveLocationPolicy({
    latitude: input.latitude,
    longitude: input.longitude,
    shareExactCoordinates: shareExact,
    locationFuzzKm: fuzzKm,
    scientificName: input.scientific_name,
    species: input.species,
  });

  const visibility = input.publish
    ? input.visibility ?? defaults.defaultVisibility
    : input.visibility ?? null;

  return {
    public_latitude: policy.publicLatitude,
    public_longitude: policy.publicLongitude,
    location_obscured_reason: policy.locationObscuredReason,
    share_exact_coordinates: shareExact,
    location_fuzz_km: policy.effectiveFuzzKm,
    visibility: visibility === "private" && input.publish ? "public" : visibility,
  };
}

export async function createSighting(
  userId: string,
  input: NewSightingInput,
  profile?: Profile | null,
): Promise<string> {
  let ownerProfile = profile;
  if (!ownerProfile) {
    ownerProfile = await getMyProfile(userId);
  }

  const locationFields = buildLocationFields(input, ownerProfile);
  const publish = input.publish && locationFields.visibility !== "private";
  const photoRows =
    input.photos?.filter((photo) => photo.photo_url?.trim()) ??
    (input.photo_url
      ? [
          {
            photo_url: input.photo_url,
            captured_at: input.observed_at ?? null,
            species: input.species,
            scientific_name: input.scientific_name ?? null,
            count: input.count,
            confidence: input.confidence ?? null,
            detected_by: input.detected_by ?? "manual",
          },
        ]
      : []);
  const primaryPhoto = photoRows[0] ?? null;

  const insertRow = {
    user_id: userId,
    species: primaryPhoto?.species?.trim() || input.species,
    scientific_name:
      primaryPhoto?.scientific_name?.trim() ||
      input.scientific_name?.trim() ||
      null,
    location_name: input.location_name ?? null,
    location_city: input.location_city ?? null,
    location_address: input.location_address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    observed_at: input.observed_at ?? new Date().toISOString(),
    rarity: input.rarity,
    count: primaryPhoto?.count ?? input.count,
    notes: input.notes ?? null,
    photo_url: primaryPhoto?.photo_url ?? input.photo_url ?? null,
    photo_count: photoRows.length,
    audio_url: input.audio_url ?? null,
    audio_predictions: input.audio_predictions ?? null,
    audio_source_sighting_id: input.audio_source_sighting_id ?? null,
    confidence: primaryPhoto?.confidence ?? input.confidence ?? null,
    detected_by: primaryPhoto?.detected_by ?? input.detected_by ?? "manual",
    published_at: publish ? new Date().toISOString() : null,
    published_audio_start_ms:
      publish && input.audio_trim ? input.audio_trim.startMs : null,
    published_audio_end_ms:
      publish && input.audio_trim ? input.audio_trim.endMs : null,
    visibility: publish ? locationFields.visibility : null,
    share_exact_coordinates: locationFields.share_exact_coordinates,
    location_fuzz_km: locationFields.location_fuzz_km,
    public_latitude: locationFields.public_latitude,
    public_longitude: locationFields.public_longitude,
    location_obscured_reason: locationFields.location_obscured_reason,
  };

  let insertResult = await supabase.from("sightings").insert(insertRow).select("id").single();
  if (insertResult.error && isSightingPhotosSchemaMissing(insertResult.error)) {
    const { photo_count: _photoCount, ...legacyRow } = insertRow;
    insertResult = await supabase.from("sightings").insert(legacyRow).select("id").single();
  }
  if (insertResult.error) throw insertResult.error;

  const sightingId = insertResult.data!.id as string;
  if (photoRows.length > 0) {
    await insertSightingPhotos(sightingId, photoRows);
  }

  if (input.companion_user_ids?.length) {
    const companionIds = input.companion_user_ids.filter((id) => id !== userId);
    await insertSightingCompanions(sightingId, companionIds);
  }

  return sightingId;
}
