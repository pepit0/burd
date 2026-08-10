import { supabase } from "@/lib/supabase";
import type { SightingCompanion } from "@/types";

interface CompanionRow {
  sighting_id: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_color: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

function mapCompanionRow(row: CompanionRow): SightingCompanion | null {
  if (!row.profiles) return null;
  return {
    user_id: row.user_id,
    username: row.profiles.username,
    avatar_color: row.profiles.avatar_color,
    avatar_url: row.profiles.avatar_url,
    full_name: row.profiles.full_name,
  };
}

export async function insertSightingCompanions(
  sightingId: string,
  userIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const rows = uniqueIds.map((userId) => ({
    sighting_id: sightingId,
    user_id: userId,
  }));

  const { error } = await supabase.from("sighting_companions").insert(rows);
  if (error) throw error;
}

export async function replaceSightingCompanions(
  sightingId: string,
  userIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("sighting_companions")
    .delete()
    .eq("sighting_id", sightingId);
  if (deleteError) throw deleteError;

  await insertSightingCompanions(sightingId, userIds);
}

export async function getSightingCompanions(
  sightingId: string,
): Promise<SightingCompanion[]> {
  const { data, error } = await supabase
    .from("sighting_companions")
    .select(
      "sighting_id, user_id, profiles(username, avatar_color, avatar_url, full_name)",
    )
    .eq("sighting_id", sightingId)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return ((data ?? []) as CompanionRow[])
    .map(mapCompanionRow)
    .filter((row): row is SightingCompanion => row != null);
}

export async function getSightingCompanionsForSightings(
  sightingIds: string[],
): Promise<Map<string, SightingCompanion[]>> {
  const result = new Map<string, SightingCompanion[]>();
  if (sightingIds.length === 0) return result;

  const { data, error } = await supabase
    .from("sighting_companions")
    .select(
      "sighting_id, user_id, profiles(username, avatar_color, avatar_url, full_name)",
    )
    .in("sighting_id", sightingIds)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01") return result;
    throw error;
  }

  for (const row of (data ?? []) as CompanionRow[]) {
    const companion = mapCompanionRow(row);
    if (!companion) continue;
    const list = result.get(row.sighting_id) ?? [];
    list.push(companion);
    result.set(row.sighting_id, list);
  }

  return result;
}
