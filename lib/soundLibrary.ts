import { supabase } from "@/lib/supabase";
import { audioUploadMeta, readLocalAudioBytes } from "@/lib/audioUpload";
import { enrichPredictions } from "@/lib/predictionLabels";
import type { Prediction, SoundLibraryEntry } from "@/types";

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

export async function uploadSoundClip(
  userId: string,
  localUri: string,
): Promise<string> {
  const { ext, contentType } = audioUploadMeta(localUri);
  const path = `${userId}/${Date.now()}.${ext}`;
  const bytes = await readLocalAudioBytes(localUri);

  const { error } = await supabase.storage
    .from("sound_clips")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("sound_clips").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveSoundToLibrary(
  userId: string,
  input: {
    localUri: string;
    durationMs: number;
    recordedAt: string;
    predictions: Prediction[];
    label?: string | null;
  },
): Promise<SoundLibraryEntry> {
  const audioUrl = await uploadSoundClip(userId, input.localUri);
  const { data, error } = await supabase
    .from("sound_library")
    .insert({
      user_id: userId,
      audio_url: audioUrl,
      duration_ms: input.durationMs,
      recorded_at: input.recordedAt,
      predictions: input.predictions,
      label: input.label?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    audio_url: data.audio_url as string,
    duration_ms: data.duration_ms as number,
    recorded_at: data.recorded_at as string,
    predictions: parsePredictions(data.predictions),
    label: (data.label as string | null) ?? null,
    sighting_id: (data.sighting_id as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

export async function getAttachableSoundLibrary(
  userId: string,
): Promise<SoundLibraryEntry[]> {
  const { data, error } = await supabase
    .from("sound_library")
    .select("*")
    .eq("user_id", userId)
    .is("sighting_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    audio_url: row.audio_url as string,
    duration_ms: row.duration_ms as number,
    recorded_at: row.recorded_at as string,
    predictions: parsePredictions(row.predictions),
    label: (row.label as string | null) ?? null,
    sighting_id: (row.sighting_id as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function getMySoundLibrary(userId: string): Promise<SoundLibraryEntry[]> {
  const { data, error } = await supabase
    .from("sound_library")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    audio_url: row.audio_url as string,
    duration_ms: row.duration_ms as number,
    recorded_at: row.recorded_at as string,
    predictions: parsePredictions(row.predictions),
    label: (row.label as string | null) ?? null,
    sighting_id: (row.sighting_id as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function getSoundLibraryEntry(
  id: string,
): Promise<SoundLibraryEntry | null> {
  const { data, error } = await supabase
    .from("sound_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    audio_url: data.audio_url as string,
    duration_ms: data.duration_ms as number,
    recorded_at: data.recorded_at as string,
    predictions: parsePredictions(data.predictions),
    label: (data.label as string | null) ?? null,
    sighting_id: (data.sighting_id as string | null) ?? null,
    created_at: data.created_at as string,
  };
}

export async function linkSoundToSighting(
  soundId: string,
  sightingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("sound_library")
    .update({ sighting_id: sightingId })
    .eq("id", soundId);
  if (error) throw error;
}

export async function deleteSoundLibraryEntry(id: string): Promise<void> {
  const { error } = await supabase.from("sound_library").delete().eq("id", id);
  if (error) throw error;
}
