import { getNearbyFeed } from "@/lib/sightings";
import {
  computeCommunityRarity,
  lookupBaselineRarity,
  maxRarity,
} from "@/lib/speciesBaselines";
import {
  getRegionalContext,
  inferRarityFromFrequency,
} from "@/lib/regionalFrequency";
import type { Rarity } from "@/types";

const WINDOW_DAYS = 90;
const MIN_REGIONAL_SIGHTINGS = 5;

/**
 * Estimate rarity from geo/season frequency priors, community sightings,
 * and hardcoded baselines (GPS missing only).
 */
export async function inferRegionalRarity(
  species: string,
  scientificName: string | null,
  lat: number | null,
  lng: number | null,
  radiusKm: number,
  observedAt?: string | null,
): Promise<Rarity> {
  const trimmed = species.trim();
  const baseline = trimmed
    ? lookupBaselineRarity(trimmed, scientificName?.trim() || null)
    : null;

  if (!trimmed) {
    return baseline ?? "common";
  }

  let frequencyRarity: Rarity | null = null;
  if (lat != null && lng != null) {
    const ctx = getRegionalContext(
      lat,
      lng,
      observedAt ? new Date(observedAt) : new Date(),
    );
    frequencyRarity = inferRarityFromFrequency(ctx, trimmed, scientificName);
  }

  if (lat == null || lng == null) {
    return frequencyRarity ?? baseline ?? "common";
  }

  try {
    const nearby = await getNearbyFeed(lat, lng, radiusKm);
    const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recent = nearby.filter(
      (s) => new Date(s.created_at).getTime() >= since,
    );

    let community: Rarity | null = null;
    if (recent.length >= MIN_REGIONAL_SIGHTINGS) {
      community = computeCommunityRarity(
        recent,
        trimmed,
        scientificName?.trim() || null,
      );
    }

    const signals = [frequencyRarity, community, baseline].filter(
      Boolean,
    ) as Rarity[];

    if (signals.length === 0) return "common";
    return signals.reduce((best, next) => maxRarity(best, next));
  } catch {
    return frequencyRarity ?? baseline ?? "common";
  }
}
