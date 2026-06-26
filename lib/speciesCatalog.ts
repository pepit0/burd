import birdCatalog from "@/data/bird-catalog.json";
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

export function getCatalogSpeciesById(id: string): CatalogSpecies | undefined {
  return catalogById.get(id);
}

export function getCatalogSpeciesByScientificName(
  scientificName: string,
): CatalogSpecies | undefined {
  return catalogByScientific.get(scientificName.trim().toLowerCase());
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
