import { matchesHashtagQuery } from "@/lib/hashtags";

export interface SightingSearchFields {
  species: string;
  scientific_name?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_address?: string | null;
  notes?: string | null;
  username?: string;
  resolvedCity?: string;
}

/** Client-side search across species, location, author, caption, and hashtags. */
export function matchesSightingSearch(
  item: SightingSearchFields,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (item.species.toLowerCase().includes(q)) return true;
  if ((item.scientific_name ?? "").toLowerCase().includes(q)) return true;
  if ((item.location_name ?? "").toLowerCase().includes(q)) return true;
  if ((item.location_city ?? "").toLowerCase().includes(q)) return true;
  if ((item.location_address ?? "").toLowerCase().includes(q)) return true;
  if ((item.resolvedCity ?? "").toLowerCase().includes(q)) return true;
  if ((item.username ?? "").toLowerCase().includes(q)) return true;
  if (matchesHashtagQuery(item.notes, q)) return true;
  if ((item.notes ?? "").toLowerCase().includes(q)) return true;

  return false;
}
