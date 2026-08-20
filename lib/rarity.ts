import { lookupBaselineRarity } from "@/lib/speciesBaselines";
import {
  getRegionalContext,
} from "@/lib/regionalFrequency";
import { scoreRegionalRarity, hasRegionalRarityConfidence } from "@/lib/rarityScoring";
import { normalizeScientificName } from "@/lib/taxonomy";
import type { Rarity, Sighting } from "@/types";

export const SHOW_SPECIES_RARITY = true;

export function isSpeciesRarityVisible(): boolean {
  return SHOW_SPECIES_RARITY;
}

export interface RegionalRarityInput {
  species: string;
  scientificName: string | null;
  lat: number | null;
  lng: number | null;
  observedAt?: string | Date | null;
}

function resolveObservedDate(observedAt?: string | Date | null): Date {
  if (observedAt instanceof Date) return observedAt;
  if (observedAt) {
    const parsed = new Date(observedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Regional rarity from percentile-ranked strict abundance at lat/lng/month.
 * Uses rarity-only priors — does not affect photo/sound ID ranking.
 */
export function lookupRegionalRarity(input: RegionalRarityInput): Rarity {
  const species = input.species.trim();
  const scientific = input.scientificName?.trim() || null;
  const key =
    normalizeScientificName(scientific) || normalizeScientificName(species);

  if (!species || !key) {
    return lookupBaselineRarity(species, scientific) ?? "common";
  }

  if (input.lat == null || input.lng == null) {
    return lookupBaselineRarity(species, scientific) ?? "common";
  }

  const ctx = getRegionalContext(
    input.lat,
    input.lng,
    resolveObservedDate(input.observedAt),
  );
  return scoreRegionalRarity(ctx, species, scientific);
}

export function isRegionalRarityReliable(input: RegionalRarityInput): boolean {
  if (input.lat == null || input.lng == null) return false;
  const ctx = getRegionalContext(
    input.lat,
    input.lng,
    resolveObservedDate(input.observedAt),
  );
  return hasRegionalRarityConfidence(ctx);
}

export function rarityForSighting(
  sighting: Pick<
    Sighting,
    | "species"
    | "scientific_name"
    | "latitude"
    | "longitude"
    | "observed_at"
    | "created_at"
  >,
): Rarity {
  return lookupRegionalRarity({
    species: sighting.species,
    scientificName: sighting.scientific_name,
    lat: sighting.latitude,
    lng: sighting.longitude,
    observedAt: sighting.observed_at ?? sighting.created_at,
  });
}

/** @deprecated Prefer lookupRegionalRarity — kept for async call sites. */
export async function inferRegionalRarity(
  species: string,
  scientificName: string | null,
  lat: number | null,
  lng: number | null,
  _radiusKm: number,
  observedAt?: string | null,
): Promise<Rarity> {
  return lookupRegionalRarity({
    species,
    scientificName,
    lat,
    lng,
    observedAt,
  });
}
