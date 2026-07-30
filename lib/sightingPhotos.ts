import { supabase } from "@/lib/supabase";
import type { DetectedBy, Sighting, SightingPhoto, SightingPhotoInput } from "@/types";

/** True when multi-photo migrations (0042) are not applied on Supabase yet. */
export function isSightingPhotosSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const record = error as { code?: string; message?: string; details?: string };
  const haystack = [record.message, record.details, record.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    record.code === "PGRST205" ||
    record.code === "PGRST204" ||
    record.code === "PGRST202" ||
    record.code === "42P01" ||
    record.code === "42883" ||
    haystack.includes("sighting_photos") ||
    haystack.includes("photo_count") ||
    haystack.includes("p_photo_url") ||
    haystack.includes("schema cache") ||
    haystack.includes("could not find the function")
  );
}

export async function getSightingPhotos(
  sightingId: string,
): Promise<SightingPhoto[]> {
  const { data, error } = await supabase
    .from("sighting_photos")
    .select("*")
    .eq("sighting_id", sightingId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isSightingPhotosSchemaMissing(error)) return [];
    throw error;
  }

  return (data ?? []) as SightingPhoto[];
}

export async function getPhotosForSightings(
  sightingIds: string[],
): Promise<Map<string, SightingPhoto[]>> {
  if (sightingIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("sighting_photos")
    .select("*")
    .in("sighting_id", sightingIds)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isSightingPhotosSchemaMissing(error)) return new Map();
    throw error;
  }

  const grouped = new Map<string, SightingPhoto[]>();
  for (const row of (data ?? []) as SightingPhoto[]) {
    const list = grouped.get(row.sighting_id) ?? [];
    list.push(row);
    grouped.set(row.sighting_id, list);
  }
  return grouped;
}

export function sightingPhotosForDisplay(sighting: Sighting): SightingPhoto[] {
  if (sighting.photos?.length) return sighting.photos;
  if (!sighting.photo_url) return [];

  return [
    {
      id: `${sighting.id}-cover`,
      sighting_id: sighting.id,
      sort_order: 0,
      photo_url: sighting.photo_url,
      captured_at: sighting.observed_at,
      species: sighting.species,
      scientific_name: sighting.scientific_name,
      count: sighting.count,
      confidence: sighting.confidence,
      detected_by: sighting.detected_by,
      created_at: sighting.created_at,
    },
  ];
}

export async function insertSightingPhotos(
  sightingId: string,
  photos: SightingPhotoInput[],
): Promise<boolean> {
  if (photos.length === 0) return true;

  const rows = photos.map((photo, index) => ({
    sighting_id: sightingId,
    sort_order: index,
    photo_url: photo.photo_url,
    captured_at: photo.captured_at ?? null,
    species: photo.species ?? null,
    scientific_name: photo.scientific_name ?? null,
    count: photo.count ?? 1,
    confidence: photo.confidence ?? null,
    detected_by: photo.detected_by ?? "manual",
  }));

  const { error } = await supabase.from("sighting_photos").insert(rows);
  if (error) {
    if (isSightingPhotosSchemaMissing(error)) return false;
    throw error;
  }

  return true;
}

export function photoSpeciesLabel(photo: SightingPhoto): string {
  return photo.species?.trim() || "Unknown species";
}

export function photoScientificLabel(photo: SightingPhoto): string | null {
  return photo.scientific_name?.trim() || null;
}

export function detectedByLabel(detectedBy: DetectedBy): string {
  switch (detectedBy) {
    case "image":
      return "Photo ID";
    case "audio":
      return "Sound ID";
    case "both":
      return "Photo + sound";
    default:
      return "Manual";
  }
}
