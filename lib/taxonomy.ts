import { enrichPrediction } from "@/lib/predictionLabels";
import {
  getCatalogSpeciesByScientificName,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";
import type { Prediction } from "@/types";

/** Lowercase genus + epithet, e.g. ``cyanocitta cristata``. */
export function normalizeScientificName(name: string | null | undefined): string {
  if (!name?.trim()) return "";
  const cleaned = name.trim().toLowerCase().replace(/_/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return cleaned;
  return `${parts[0]} ${parts[1]}`;
}

export function resolveToCatalogScientific(
  prediction: Prediction,
): string {
  const enriched = enrichPrediction(prediction);
  const fromField = normalizeScientificName(enriched.scientific_name);
  if (fromField && getCatalogSpeciesByScientificName(fromField)) {
    return fromField;
  }

  const byCommon = resolveCatalogSpecies(
    enriched.species,
    enriched.scientific_name,
  );
  if (byCommon) {
    return normalizeScientificName(byCommon.scientific_name);
  }

  return fromField || normalizeScientificName(enriched.species);
}

export function isInCatalog(scientificName: string): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;
  return Boolean(getCatalogSpeciesByScientificName(key));
}

export function scientificKeyForPrediction(prediction: Prediction): string {
  return resolveToCatalogScientific(prediction) || detectionKey(prediction);
}

function detectionKey(prediction: Prediction): string {
  return (
    normalizeScientificName(prediction.scientific_name) ||
    prediction.species.trim().toLowerCase()
  );
}
