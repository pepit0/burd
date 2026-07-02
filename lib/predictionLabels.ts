import type { Prediction } from "@/types";
import {
  getCommonNameByScientific,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";
import { commonNameForScientific as photoCommonName } from "@/lib/photoTaxonomy";
import { commonNameForScientific as soundCommonName } from "@/lib/soundTaxonomy";

function normalizeLabel(value: string): string {
  return value.trim().replace(/_/g, " ");
}

function formatBinomial(name: string): string {
  const parts = normalizeLabel(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return normalizeLabel(name);
  const genus = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const epithet = parts[1].toLowerCase();
  return `${genus} ${epithet}`;
}

/** Genus + epithet — supports ``Turdus migratorius`` and ``turdus migratorius``. */
function looksLikeBinomial(name: string): boolean {
  const parts = normalizeLabel(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (/^[A-Z][a-z-]+$/.test(parts[0]) && /^[a-z][a-z-]+$/.test(parts[1])) {
    return true;
  }
  return /^[a-z-]+$/.test(parts[0]) && /^[a-z-]+$/.test(parts[1]);
}

function binomialFromUnderscores(text: string): string | null {
  const parts = text.split("_").filter(Boolean);
  if (parts.length < 2) return null;

  const genus = parts[parts.length - 2];
  const epithet = parts[parts.length - 1];
  if (!/^[A-Za-z-]+$/.test(genus) || !/^[A-Za-z-]+$/.test(epithet)) {
    return null;
  }

  return formatBinomial(`${genus} ${epithet}`);
}

/** Pull a binomial out of Perch / iNat-style model labels. */
function extractScientificFromLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed.includes("_")) {
    const fromUnderscore = binomialFromUnderscores(trimmed);
    if (fromUnderscore) return fromUnderscore;
  }

  let text = trimmed;
  if (text.includes(":")) {
    text = text.split(":").pop()?.trim() ?? text;
  }

  text = normalizeLabel(text);
  if (looksLikeBinomial(text)) return formatBinomial(text);
  return "";
}

function resolveScientificName(prediction: Prediction): string {
  const fromField = prediction.scientific_name?.trim();
  if (fromField) return formatBinomial(fromField);

  return extractScientificFromLabel(prediction.species);
}

function resolveCommonName(rawSpecies: string, scientific: string): string | null {
  if (scientific) {
    const fromPhotoTaxonomy = photoCommonName(scientific);
    if (fromPhotoTaxonomy) return fromPhotoTaxonomy;

    const fromSoundTaxonomy = soundCommonName(scientific);
    if (fromSoundTaxonomy) return fromSoundTaxonomy;

    const fromScientific = getCommonNameByScientific(scientific);
    if (fromScientific) return fromScientific;
  }

  const raw = rawSpecies.trim();
  if (raw && !raw.includes("_") && !looksLikeBinomial(raw)) {
    return raw;
  }

  if (raw) {
    const byResolved = resolveCatalogSpecies(raw, scientific || null);
    if (byResolved) return byResolved.species;
  }

  return null;
}

/** Normalize API / stored predictions to English common + scientific fields. */
export function enrichPrediction(prediction: Prediction): Prediction {
  const scientific = resolveScientificName(prediction);
  const common =
    resolveCommonName(prediction.species, scientific) ||
    (scientific || normalizeLabel(prediction.species) || "Unknown species");

  return {
    species: common,
    scientific_name: scientific || null,
    confidence: prediction.confidence,
  };
}

export function enrichPredictions(predictions: Prediction[]): Prediction[] {
  return predictions.map(enrichPrediction);
}

/** Prefer English common names over raw model labels (e.g. Turdus_migratorius). */
export function displaySpeciesName(prediction: Prediction): string {
  return enrichPrediction(prediction).species;
}

export function displayScientificName(prediction: Prediction): string | null {
  const enriched = enrichPrediction(prediction);
  const scientific = enriched.scientific_name?.trim();
  if (!scientific) return null;

  if (enriched.species.toLowerCase() === scientific.toLowerCase()) return null;
  return scientific;
}
