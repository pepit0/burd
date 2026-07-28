import { lookupBaselineRarity } from "@/lib/speciesBaselines";
import {
  getRegionalContext,
  lookupSpeciesScoreStrict,
} from "@/lib/regionalFrequency";
import { normalizeScientificName } from "@/lib/taxonomy";
import type { Rarity, Sighting } from "@/types";

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
 * Regional rarity from strict month-matched GBIF + checklist priors —
 * same model as Field Guide Explore abundance.
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
  return lookupSpeciesScoreStrict(ctx, key).rarity;
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
