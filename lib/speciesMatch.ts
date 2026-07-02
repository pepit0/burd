import type { Prediction } from "@/types";

/** Sound must reach this before it can confirm a photo match. */
export const SOUND_CONFIRM_MIN_CONFIDENCE = 0.08;

export function speciesMatchKey(prediction: {
  scientific_name?: string | null;
  species?: string;
}): string {
  const scientific = prediction.scientific_name?.trim().toLowerCase();
  if (scientific) return scientific;
  return (prediction.species ?? "").trim().toLowerCase();
}

export function speciesKeysMatch(
  a: { key?: string; prediction?: Prediction } | null,
  b: { key?: string; prediction?: Prediction } | null,
): boolean {
  if (!a || !b) return false;
  const keyA = a.key ?? (a.prediction ? speciesMatchKey(a.prediction) : "");
  const keyB = b.key ?? (b.prediction ? speciesMatchKey(b.prediction) : "");
  return Boolean(keyA && keyB && keyA === keyB);
}

/** Whether live/recorded sound supports the photo species (display only — no score change). */
export function soundConfirmsPhoto(
  photoTop: Prediction | null,
  soundTop: Prediction | null,
): boolean {
  if (!photoTop || !soundTop) return false;
  return (
    speciesMatchKey(photoTop) === speciesMatchKey(soundTop) &&
    soundTop.confidence >= SOUND_CONFIRM_MIN_CONFIDENCE
  );
}
