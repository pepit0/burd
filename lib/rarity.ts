import { getNearbyFeed } from "@/lib/sightings";
import {
  computeCommunityRarity,
  lookupBaselineRarity,
  maxRarity,
} from "@/lib/speciesBaselines";
import type { Rarity } from "@/types";

const WINDOW_DAYS = 90;
const MIN_REGIONAL_SIGHTINGS = 5;

/**
 * Estimate rarity from species baselines plus recent community sightings
 * near the user's location. Takes whichever signal is rarer.
 */
export async function inferRegionalRarity(
  species: string,
  scientificName: string | null,
  lat: number | null,
  lng: number | null,
  radiusKm: number,
): Promise<Rarity> {
  const trimmed = species.trim();
  const baseline = trimmed
    ? lookupBaselineRarity(trimmed, scientificName?.trim() || null)
    : null;

  if (!trimmed) {
    return baseline ?? "common";
  }

  if (lat == null || lng == null) {
    return baseline ?? "common";
  }

  try {
    const nearby = await getNearbyFeed(lat, lng, radiusKm);
    const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recent = nearby.filter(
      (s) => new Date(s.created_at).getTime() >= since,
    );

    if (recent.length < MIN_REGIONAL_SIGHTINGS) {
      return baseline ?? "common";
    }

    const community = computeCommunityRarity(
      recent,
      trimmed,
      scientificName?.trim() || null,
    );

    if (baseline && community) {
      return maxRarity(baseline, community);
    }
    return community ?? baseline ?? "common";
  } catch {
    return baseline ?? "common";
  }
}
