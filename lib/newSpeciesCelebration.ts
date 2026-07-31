import { displaySpeciesName } from "@/lib/predictionLabels";
import { speciesMatchKey } from "@/lib/speciesMatch";
import type { Sighting } from "@/types";

export interface NewSpeciesCelebration {
  key: string;
  species: string;
  scientificName: string | null;
  lifeListCount: number;
}

export function loggedSpeciesKeys(sightings: Sighting[]): Set<string> {
  const keys = new Set<string>();
  for (const sighting of sightings) {
    const key = speciesMatchKey({
      species: sighting.species,
      scientific_name: sighting.scientific_name,
    });
    if (key) keys.add(key);
  }
  return keys;
}

export function isFirstLogForSpecies(
  sightings: Sighting[],
  species: string,
  scientificName?: string | null,
): boolean {
  const key = speciesMatchKey({
    species,
    scientific_name: scientificName,
  });
  if (!key) return false;
  return !loggedSpeciesKeys(sightings).has(key);
}

export function lifeListCountAfterAdd(sightings: Sighting[], isNewSpecies: boolean): number {
  const count = loggedSpeciesKeys(sightings).size;
  return isNewSpecies ? count + 1 : count;
}

export function buildNewSpeciesCelebration(
  species: string,
  scientificName: string | null | undefined,
  lifeListCount: number,
): NewSpeciesCelebration {
  const trimmedSpecies = species.trim();
  const trimmedScientific = scientificName?.trim() || null;
  return {
    key: speciesMatchKey({
      species: trimmedSpecies,
      scientific_name: trimmedScientific,
    }),
    species: trimmedSpecies,
    scientificName: trimmedScientific,
    lifeListCount,
  };
}

export function newSpeciesCelebrationTitle(
  species: string,
  scientificName?: string | null,
): string {
  return displaySpeciesName({
    species,
    scientific_name: scientificName ?? null,
    confidence: 0,
  });
}

export function newSpeciesCelebrationDescription(lifeListCount: number): string {
  if (lifeListCount <= 1) {
    return "Your first bird on your life list.";
  }
  return `Species #${lifeListCount} on your life list.`;
}
