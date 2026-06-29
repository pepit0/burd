import soundTaxonomyIndex from "@/data/sound-taxonomy-index.json";
import { normalizeScientificName } from "@/lib/taxonomy";
import type { Prediction } from "@/types";

const index = soundTaxonomyIndex as Record<string, string>;

export function isInSoundTaxonomy(scientificName: string | null | undefined): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;
  return Object.prototype.hasOwnProperty.call(index, key);
}

export function commonNameForScientific(
  scientificName: string | null | undefined,
): string | null {
  const key = normalizeScientificName(scientificName);
  if (!key) return null;
  return index[key] ?? null;
}

/** Sound paths use Perch scientific names directly — not photo-catalog resolution. */
export function scientificKeyForSoundPrediction(prediction: Prediction): string {
  return (
    normalizeScientificName(prediction.scientific_name) ||
    prediction.species.trim().toLowerCase()
  );
}

export function isSoundSpeciesKey(key: string): boolean {
  return isInSoundTaxonomy(key);
}
