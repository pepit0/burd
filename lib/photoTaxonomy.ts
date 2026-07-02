import photoTaxonomyIndex from "@/data/photo-taxonomy-index.json";
import { normalizeScientificName } from "@/lib/taxonomy";
import type { Prediction } from "@/types";

const index = photoTaxonomyIndex as Record<string, string>;

export function isInPhotoTaxonomy(scientificName: string | null | undefined): boolean {
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

/** Photo paths use iNat21 scientific names directly. */
export function scientificKeyForPhotoPrediction(prediction: Prediction): string {
  return (
    normalizeScientificName(prediction.scientific_name) ||
    prediction.species.trim().toLowerCase()
  );
}
