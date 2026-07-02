import birdCatalog from "@/data/bird-catalog.json";
import scientificCommon from "@/data/scientific-common.json";
import { commonNameForScientific as photoCommonName } from "@/lib/photoTaxonomy";
import { lookupBaselineRarity } from "@/lib/speciesBaselines";
import type { Rarity } from "@/types";

export interface CatalogSpecies {
  id: string;
  species: string;
  scientific_name: string;
  family: string;
  class_index: number;
  rarity: Rarity;
}

type RawCatalogEntry = Omit<CatalogSpecies, "rarity">;

function withRarity(entry: RawCatalogEntry): CatalogSpecies {
  return {
    ...entry,
    rarity: lookupBaselineRarity(entry.species, entry.scientific_name) ?? "common",
  };
}

/** All bird species the vision model can identify (~1,500 iNat21 Aves taxa). */
export const SPECIES_CATALOG: CatalogSpecies[] = (
  birdCatalog as RawCatalogEntry[]
).map(withRarity);

const catalogById = new Map(SPECIES_CATALOG.map((species) => [species.id, species]));
const catalogByScientific = new Map(
  SPECIES_CATALOG.map((species) => [
    species.scientific_name.trim().toLowerCase(),
    species,
  ]),
);
const commonByScientific = new Map(
  Object.entries(scientificCommon as Record<string, string>).map(([key, value]) => [
    key.trim().toLowerCase(),
    value,
  ]),
);

export function getCatalogSpeciesById(id: string): CatalogSpecies | undefined {
  return catalogById.get(id);
}

function normalizeScientificKey(scientificName: string): string {
  return scientificName.trim().toLowerCase().replace(/_/g, " ");
}

function binomialKey(scientificName: string): string | null {
  const parts = normalizeScientificKey(scientificName).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]} ${parts[1]}`;
}

export function getCatalogSpeciesByScientificName(
  scientificName: string,
): CatalogSpecies | undefined {
  const normalized = normalizeScientificKey(scientificName);
  const direct = catalogByScientific.get(normalized);
  if (direct) return direct;

  const binomial = binomialKey(normalized);
  if (binomial) {
    return catalogByScientific.get(binomial);
  }

  return undefined;
}

/** English common name for a scientific name, when known in the catalog. */
export function getCommonNameByScientific(scientificName: string): string | undefined {
  const fromCatalog = getCatalogSpeciesByScientificName(scientificName)?.species;
  if (fromCatalog) return fromCatalog;

  const normalized = normalizeScientificKey(scientificName);
  const direct = commonByScientific.get(normalized);
  if (direct) return direct;

  const binomial = binomialKey(normalized);
  if (binomial) {
    return commonByScientific.get(binomial);
  }

  return photoCommonName(scientificName) ?? undefined;
}

/** Match a logged sighting to a catalog entry (scientific name preferred). */
export function resolveCatalogSpecies(
  species: string,
  scientificName: string | null | undefined,
): CatalogSpecies | undefined {
  if (scientificName?.trim()) {
    const byScientific = getCatalogSpeciesByScientificName(scientificName);
    if (byScientific) return byScientific;
  }

  const common = species.trim().toLowerCase();
  if (!common) return undefined;

  return SPECIES_CATALOG.find((entry) => entry.species.toLowerCase() === common);
}
