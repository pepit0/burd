import type { DetectedBy, Prediction } from "@/types";

/** Sound must reach this before it can confirm a photo match. */
const AUDIO_CONFIRM_MIN = 0.08;
/** Max boost added to photo confidence when sound agrees. */
const AUDIO_BOOST_CAP = 0.12;

export interface FusedIdentification {
  top: Prediction | null;
  detectedBy: DetectedBy;
  imageTop: Prediction | null;
  audioTop: Prediction | null;
  agreed: boolean;
}

function normalizeKey(prediction: Prediction): string {
  const scientific = prediction.scientific_name?.trim().toLowerCase();
  if (scientific) return scientific;
  return prediction.species.trim().toLowerCase();
}

/**
 * Merge birder (photo) and Perch (sound) predictions.
 * Photo is primary — sound can confirm and slightly boost, never override or reduce.
 */
export function fusePredictions(
  imagePreds: Prediction[],
  audioPreds: Prediction[],
): FusedIdentification {
  const imageTop = imagePreds[0] ?? null;
  const audioTop = audioPreds[0] ?? null;

  if (!imageTop && !audioTop) {
    return {
      top: null,
      detectedBy: "manual",
      imageTop: null,
      audioTop: null,
      agreed: false,
    };
  }

  if (!imageTop) {
    return {
      top: audioTop,
      detectedBy: "audio",
      imageTop: null,
      audioTop,
      agreed: false,
    };
  }

  if (!audioTop) {
    return {
      top: imageTop,
      detectedBy: "image",
      imageTop,
      audioTop: null,
      agreed: false,
    };
  }

  const agreed = normalizeKey(imageTop) === normalizeKey(audioTop);
  const soundConfirms =
    agreed && audioTop.confidence >= AUDIO_CONFIRM_MIN;

  let confidence = imageTop.confidence;
  if (soundConfirms) {
    confidence = Math.min(
      0.99,
      imageTop.confidence + Math.min(AUDIO_BOOST_CAP, audioTop.confidence * 0.2),
    );
  }

  return {
    top: {
      ...imageTop,
      confidence: Math.round(confidence * 10000) / 10000,
    },
    detectedBy: soundConfirms ? "both" : "image",
    imageTop,
    audioTop,
    agreed: soundConfirms,
  };
}

export function detectionSourceLabel(source: DetectedBy): string {
  switch (source) {
    case "audio":
      return "sound";
    case "both":
      return "photo + sound";
    case "image":
      return "photo";
    default:
      return "manual entry";
  }
}
