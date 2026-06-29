import type { FeedSighting, Rarity } from "@/types";
import { kmBetween } from "@/lib/geo";

export type FeedRarityFilter = Rarity | "all";
export type FeedNearbyFilter = "all" | "nearby";

export interface FeedContentFilters {
  rarity: FeedRarityFilter;
  nearby: FeedNearbyFilter;
}

export const DEFAULT_FEED_CONTENT_FILTERS: FeedContentFilters = {
  rarity: "all",
  nearby: "all",
};

export interface FeedFilterContext {
  coords: { latitude: number; longitude: number } | null;
  radiusKm: number;
}

export function countActiveFeedFilters(filters: FeedContentFilters): number {
  let count = 0;
  if (filters.rarity !== "all") count += 1;
  if (filters.nearby !== "all") count += 1;
  return count;
}

export function applyFeedContentFilters(
  sightings: FeedSighting[],
  filters: FeedContentFilters,
  context: FeedFilterContext,
): FeedSighting[] {
  return sightings.filter((sighting) => {
    if (filters.rarity !== "all" && sighting.rarity !== filters.rarity) {
      return false;
    }
    if (filters.nearby === "nearby") {
      const { coords, radiusKm } = context;
      if (
        !coords ||
        sighting.latitude == null ||
        sighting.longitude == null
      ) {
        return false;
      }
      if (
        kmBetween(
          coords.latitude,
          coords.longitude,
          sighting.latitude,
          sighting.longitude,
        ) > radiusKm
      ) {
        return false;
      }
    }
    return true;
  });
}

export type FieldGuideLoggedFilter = "all" | "logged" | "unlogged";

export interface FieldGuideFilters {
  rarity: FeedRarityFilter;
  logged: FieldGuideLoggedFilter;
}

export const DEFAULT_FIELD_GUIDE_FILTERS: FieldGuideFilters = {
  rarity: "all",
  logged: "all",
};

export function countActiveFieldGuideFilters(filters: FieldGuideFilters): number {
  let count = 0;
  if (filters.rarity !== "all") count += 1;
  if (filters.logged !== "all") count += 1;
  return count;
}
