import type { CatalogSpecies } from "@/lib/speciesCatalog";
import { SPECIES_PROFILES } from "@/lib/speciesProfiles";
import { observedDate } from "@/lib/sightingFormat";
import type { Rarity, Sighting } from "@/types";

export interface FieldGuideEntry {
  id: string;
  species: string;
  scientific_name: string;
  family: string;
  habitat: string;
  rarity: Rarity;
  logged: boolean;
}

interface SightingHit {
  latest_sighting_id: string;
  latest_observed_at: string;
}

function matchKey(scientificName: string | null, species: string): string {
  return (scientificName ?? species).trim().toLowerCase();
}

export function buildSightingIndex(
  sightings: Sighting[],
): Map<string, SightingHit> {
  const map = new Map<string, SightingHit>();

  for (const sighting of sightings) {
    const keys = new Set<string>();
    if (sighting.scientific_name) {
      keys.add(matchKey(sighting.scientific_name, sighting.species));
    }
    keys.add(matchKey(null, sighting.species));

    const when = observedDate(sighting).toISOString();

    for (const key of keys) {
      const existing = map.get(key);
      if (!existing || when >= existing.latest_observed_at) {
        map.set(key, {
          latest_sighting_id: sighting.id,
          latest_observed_at: when,
        });
      }
    }
  }

  return map;
}

function isLogged(
  catalog: CatalogSpecies,
  index: Map<string, SightingHit>,
): boolean {
  return (
    index.has(matchKey(catalog.scientific_name, catalog.species)) ||
    index.has(matchKey(null, catalog.species))
  );
}

export function toFieldGuideEntry(
  item: CatalogSpecies,
  index: Map<string, SightingHit>,
): FieldGuideEntry {
  return {
    id: item.id,
    species: item.species,
    scientific_name: item.scientific_name,
    family: item.family,
    habitat: SPECIES_PROFILES[item.id]?.habitat ?? "",
    rarity: item.rarity,
    logged: isLogged(item, index),
  };
}

export function countLoggedInCatalog(
  catalog: CatalogSpecies[],
  index: Map<string, SightingHit>,
): number {
  let count = 0;
  for (const item of catalog) {
    if (isLogged(item, index)) count += 1;
  }
  return count;
}

/** Sightings matching a catalog species, newest first. */
export function getSightingsForSpecies(
  catalog: CatalogSpecies,
  sightings: Sighting[],
): Sighting[] {
  const scientific = catalog.scientific_name.toLowerCase();
  const common = catalog.species.toLowerCase();

  return sightings
    .filter((sighting) => {
      if (sighting.scientific_name?.toLowerCase() === scientific) return true;
      return sighting.species.toLowerCase() === common;
    })
    .sort(
      (a, b) =>
        observedDate(b).getTime() - observedDate(a).getTime(),
    );
}

export function filterCatalog(
  catalog: CatalogSpecies[],
  query: string,
): CatalogSpecies[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;

  return catalog.filter(
    (item) =>
      item.species.toLowerCase().includes(q) ||
      item.scientific_name.toLowerCase().includes(q) ||
      item.family.toLowerCase().includes(q),
  );
}

/** @deprecated Use filterCatalog + toFieldGuideEntry for paginated lists. */
export function mergeCatalogWithSightings(
  catalog: CatalogSpecies[],
  sightings: Sighting[],
): FieldGuideEntry[] {
  const index = buildSightingIndex(sightings);
  return catalog.map((item) => toFieldGuideEntry(item, index));
}

/** @deprecated Use filterCatalog. */
export function filterFieldGuide(
  entries: FieldGuideEntry[],
  query: string,
): FieldGuideEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  return entries.filter(
    (entry) =>
      entry.species.toLowerCase().includes(q) ||
      entry.scientific_name.toLowerCase().includes(q) ||
      entry.family.toLowerCase().includes(q),
  );
}
