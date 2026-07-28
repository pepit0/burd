import type { LiveDetection } from "@/lib/liveSoundSession";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import type { SpeciesImageLightboxTarget } from "@/components/SpeciesImageLightbox";

export function speciesImageTargetFromDetection(
  detection: LiveDetection,
): SpeciesImageLightboxTarget {
  const commonName = displaySpeciesName(detection.prediction);
  const scientificLabel = displayScientificName(detection.prediction);
  return {
    catalogId: detection.catalogId,
    scientificName:
      detection.prediction.scientific_name ?? scientificLabel ?? commonName,
    commonName,
    scientificLabel,
  };
}
