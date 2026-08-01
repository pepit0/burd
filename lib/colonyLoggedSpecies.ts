import {
  buildSightingIndex,
  toFieldGuideEntry,
  type FieldGuideEntry,
} from "@/lib/fieldGuide";
import { SPECIES_CATALOG } from "@/lib/speciesCatalog";
import type { Sighting } from "@/types";

/** Unique catalog species the user has logged at least once. */
export function getLoggedColonySpecies(sightings: Sighting[]): FieldGuideEntry[] {
  const index = buildSightingIndex(sightings);
  const logged: FieldGuideEntry[] = [];

  for (const item of SPECIES_CATALOG) {
    const entry = toFieldGuideEntry(item, index, null);
    if (entry.logged) {
      logged.push(entry);
    }
  }

  return logged.sort((a, b) => a.species.localeCompare(b.species));
}

/** Stable 0..1 from a string (per-species animation seed). */
export function colonySeed(value: string, salt = 0): number {
  let hash = salt;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return (hash % 10_000) / 10_000;
}
