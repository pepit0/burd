import type { Prediction } from "@/types";
import {
  getCatalogSpeciesByScientificName,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";

function normalizeScientificName(value: string): string {
  return value.trim().replace(/_/g, " ");
}

/** Prefer English common names over raw model labels (e.g. Turdus_migratorius). */
export function displaySpeciesName(prediction: Prediction): string {
  const raw = prediction.species.trim();
  if (raw && !raw.includes("_")) {
    const byCommon = resolveCatalogSpecies(raw, prediction.scientific_name);
    if (byCommon) return byCommon.species;
    return raw;
  }

  const scientific = normalizeScientificName(
    prediction.scientific_name ?? raw,
  );
  const catalog =
    getCatalogSpeciesByScientificName(scientific) ??
    resolveCatalogSpecies(raw, scientific);

  if (catalog) return catalog.species;
  if (scientific && !scientific.includes("_")) return scientific;
  return normalizeScientificName(raw);
}

export function displayScientificName(prediction: Prediction): string | null {
  const scientific = prediction.scientific_name?.trim();
  if (scientific) return normalizeScientificName(scientific);

  const raw = prediction.species.trim();
  if (raw.includes("_")) {
    const normalized = normalizeScientificName(raw);
    return normalized.includes(" ") ? normalized : null;
  }

  return null;
}
