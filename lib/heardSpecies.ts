import type { Prediction } from "@/types";
import type { SessionAnalysis } from "@/lib/pendingCapture";

/** Default floor for multi-species "heard" lists (matches server TOP_K min). */
export const HEARD_SPECIES_MIN_CONFIDENCE = 0.05;

/** Species distinct enough to count as "heard" in a session clip. */
export function distinctHeardSpecies(
  predictions: Prediction[],
  minConfidence = HEARD_SPECIES_MIN_CONFIDENCE,
): Prediction[] {
  const seen = new Set<string>();
  const heard: Prediction[] = [];

  for (const prediction of predictions) {
    if (prediction.confidence < minConfidence) continue;
    const key =
      prediction.scientific_name?.trim().toLowerCase() ||
      prediction.species.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    heard.push(prediction);
  }

  return heard;
}

/** Prefer server-side session aggregation when available. */
export function resolveHeardSpecies(
  predictions: Prediction[],
  heardSpecies?: Prediction[] | null,
  minConfidence = HEARD_SPECIES_MIN_CONFIDENCE,
): Prediction[] {
  if (heardSpecies && heardSpecies.length > 0) {
    return heardSpecies;
  }

  const fromPredictions = distinctHeardSpecies(predictions, minConfidence);
  if (fromPredictions.length > 0) {
    return fromPredictions;
  }

  return predictions.length > 0 ? [predictions[0]] : [];
}

/** Best species list to show on the sound report / library save. */
export function soundReportSpecies(
  analysis: SessionAnalysis | undefined,
): Prediction[] {
  if (!analysis) return [];

  if (analysis.heardSpecies.length > 0) {
    return analysis.heardSpecies;
  }

  if (analysis.audioPredictions.length > 0) {
    return resolveHeardSpecies(analysis.audioPredictions);
  }

  if (
    analysis.top &&
    (analysis.detectedBy === "audio" || analysis.detectedBy === "both")
  ) {
    return [analysis.top];
  }

  return [];
}
