import {
  calculateBirdProbabilities,
  DEFAULT_SOUND_SOFTMAX_TEMPERATURE,
} from "@/lib/calculateBirdProbabilities";
import { checklistSpeciesForCoords } from "@/lib/speciesChecklist";
import { normalizeScientificName } from "@/lib/taxonomy";
import type { Prediction } from "@/types";

export interface NativeLogit {
  species_code: string;
  logit: number;
}

function predictionKey(prediction: Prediction): string {
  return normalizeScientificName(
    prediction.scientific_name ?? prediction.species,
  );
}

/**
 * Rescore display confidences for native species already in the server pool.
 * Does NOT replace the list with global checklist top-K (that caused Snowy Owl etc.).
 */
export function applyNativeDisplayScoring(
  predictions: Prediction[],
  heardSpecies: Prediction[],
  nativeLogits: NativeLogit[] | undefined,
  geo?: { lat?: number | null; lng?: number | null; observedAt?: string | null },
  temperature: number = DEFAULT_SOUND_SOFTMAX_TEMPERATURE,
): { predictions: Prediction[]; heardSpecies: Prediction[] } {
  if (!nativeLogits?.length || geo?.lat == null || geo?.lng == null) {
    return { predictions, heardSpecies };
  }

  const when = geo.observedAt ? new Date(geo.observedAt) : new Date();
  const validCodes = checklistSpeciesForCoords(
    geo.lat,
    geo.lng,
    when.getMonth() + 1,
  );
  if (!validCodes.length) {
    return { predictions, heardSpecies };
  }

  const validSet = new Set(validCodes.map((code) => code.toLowerCase()));
  const logitMap = new Map(
    nativeLogits.map((entry) => [
      normalizeScientificName(entry.species_code),
      entry.logit,
    ]),
  );

  const seen = new Set<string>();
  const poolNatives: { speciesCode: string; logit: number }[] = [];

  for (const prediction of [...predictions, ...heardSpecies]) {
    const key = predictionKey(prediction);
    if (!key || seen.has(key) || !validSet.has(key)) continue;
    const logit = logitMap.get(key);
    if (logit == null) continue;
    seen.add(key);
    poolNatives.push({ speciesCode: key, logit });
  }

  if (!poolNatives.length) {
    return { predictions, heardSpecies };
  }

  const maxOriginalConf = Math.max(
    ...[...predictions, ...heardSpecies].map((p) => p.confidence),
    0,
  );
  if (maxOriginalConf < 0.1) {
    return { predictions, heardSpecies };
  }

  const scored = calculateBirdProbabilities(
    poolNatives,
    validCodes,
    temperature,
    poolNatives.length,
  );
  if (!scored.length) {
    return { predictions, heardSpecies };
  }

  const scoreMap = new Map(
    scored.map((entry) => [
      normalizeScientificName(entry.speciesCode),
      entry.confidence,
    ]),
  );

  const rescore = (items: Prediction[]): Prediction[] =>
    items
      .map((prediction) => {
        const key = predictionKey(prediction);
        if (!validSet.has(key)) return null;
        const confidence = scoreMap.get(key);
        if (confidence != null) {
          const capped = Math.min(confidence, prediction.confidence * 1.5);
          return { ...prediction, confidence: capped };
        }
        return prediction;
      })
      .filter((prediction): prediction is Prediction => prediction != null)
      .sort((a, b) => b.confidence - a.confidence);

  return {
    predictions: rescore(predictions),
    heardSpecies: rescore(heardSpecies),
  };
}
