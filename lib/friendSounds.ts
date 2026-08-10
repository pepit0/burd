import { supabase } from "@/lib/supabase";
import { enrichPredictions } from "@/lib/predictionLabels";
import { getMyFriendIds } from "@/lib/social";
import type { Prediction } from "@/types";

export interface FriendSoundPost {
  sighting_id: string;
  user_id: string;
  username: string;
  avatar_color: string;
  avatar_url: string | null;
  species: string;
  scientific_name: string | null;
  audio_url: string;
  audio_predictions: Prediction[];
  published_at: string;
}

function parsePredictions(raw: unknown): Prediction[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw.filter(
    (row): row is Prediction =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as Prediction).species === "string" &&
      typeof (row as Prediction).confidence === "number",
  );
  return enrichPredictions(parsed);
}

/** Public posts from friends that include borrowable audio clips. */
export async function getFriendBorrowableSounds(
  userId: string,
): Promise<FriendSoundPost[]> {
  const friendIds = await getMyFriendIds(userId);
  if (friendIds.size === 0) return [];

  const { data, error } = await supabase
    .from("sightings")
    .select(
      `
      id,
      user_id,
      species,
      scientific_name,
      audio_url,
      audio_predictions,
      published_at,
      profiles!inner(username, avatar_color, avatar_url)
    `,
    )
    .in("user_id", [...friendIds])
    .not("published_at", "is", null)
    .is("removed_at", null)
    .not("audio_url", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const profile = row.profiles as {
        username: string;
        avatar_color: string;
        avatar_url: string | null;
      } | null;
      if (!profile || !row.audio_url) return null;

      return {
        sighting_id: row.id as string,
        user_id: row.user_id as string,
        username: profile.username,
        avatar_color: profile.avatar_color,
        avatar_url: profile.avatar_url,
        species: row.species as string,
        scientific_name: (row.scientific_name as string | null) ?? null,
        audio_url: row.audio_url as string,
        audio_predictions: parsePredictions(row.audio_predictions),
        published_at: row.published_at as string,
      } satisfies FriendSoundPost;
    })
    .filter((row): row is FriendSoundPost => row != null);
}

export async function getAudioSourceAttribution(
  sourceSightingId: string,
): Promise<{ sighting_id: string; user_id: string; username: string } | null> {
  const { data, error } = await supabase
    .from("sightings")
    .select("id, user_id, profiles!inner(username)")
    .eq("id", sourceSightingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const profile = data.profiles as { username: string } | null;
  if (!profile) return null;

  return {
    sighting_id: data.id as string,
    user_id: data.user_id as string,
    username: profile.username,
  };
}

export async function getAudioSourceAttributions(
  sourceSightingIds: string[],
): Promise<Map<string, { sighting_id: string; user_id: string; username: string }>> {
  const result = new Map<
    string,
    { sighting_id: string; user_id: string; username: string }
  >();
  if (sourceSightingIds.length === 0) return result;

  const { data, error } = await supabase
    .from("sightings")
    .select("id, user_id, profiles!inner(username)")
    .in("id", sourceSightingIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const profile = row.profiles as { username: string } | null;
    if (!profile) continue;
    result.set(row.id as string, {
      sighting_id: row.id as string,
      user_id: row.user_id as string,
      username: profile.username,
    });
  }

  return result;
}
