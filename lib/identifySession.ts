import { fusePredictions, type FusedIdentification } from "@/lib/fusePredictions";
import { resolveHeardSpecies } from "@/lib/heardSpecies";
import {
  identifyAudio,
  identifyImage,
  type IdentifyGeoOptions,
} from "@/lib/identify";
import type { Prediction } from "@/types";

export interface SessionIdentification extends FusedIdentification {
  count: number;
  imagePredictions: Prediction[];
  audioPredictions: Prediction[];
  heardSpecies: Prediction[];
}

/** Run photo and/or sound ID in parallel, then fuse the results. */
export async function identifySession({
  photoUri,
  audioUri,
  skipPhotoAuthenticity = false,
  photoBase64,
  geo,
}: {
  photoUri?: string | null;
  audioUri?: string | null;
  skipPhotoAuthenticity?: boolean;
  photoBase64?: string | null;
  geo?: IdentifyGeoOptions;
}): Promise<SessionIdentification> {
  let imagePredictions: Prediction[] = [];
  let audioPredictions: Prediction[] = [];
  let count = 1;

  const [imageResult, audioResult] = await Promise.allSettled([
    photoUri
      ? identifyImage(photoUri, {
          skipAuthenticity: skipPhotoAuthenticity,
          base64: photoBase64,
          geo,
        })
      : Promise.resolve(null),
    audioUri ? identifyAudio(audioUri, geo) : Promise.resolve(null),
  ]);

  if (photoUri) {
    if (imageResult.status === "fulfilled" && imageResult.value) {
      imagePredictions = imageResult.value.predictions;
      count = imageResult.value.count;
    } else if (imageResult.status === "rejected") {
      throw imageResult.reason;
    }
  }

  if (audioResult.status === "fulfilled" && audioResult.value) {
    audioPredictions = audioResult.value.predictions;
  }

  const fused = fusePredictions(imagePredictions, audioPredictions);
  const heardFromServer =
    audioResult.status === "fulfilled" && audioResult.value
      ? audioResult.value.heardSpecies
      : null;

  return {
    ...fused,
    count,
    imagePredictions,
    audioPredictions,
    heardSpecies: resolveHeardSpecies(audioPredictions, heardFromServer),
  };
}
