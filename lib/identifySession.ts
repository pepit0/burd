import { fusePredictions, type FusedIdentification } from "@/lib/fusePredictions";
import { identifyAudio, identifyImage } from "@/lib/identify";
import type { Prediction } from "@/types";

export interface SessionIdentification extends FusedIdentification {
  count: number;
  imagePredictions: Prediction[];
  audioPredictions: Prediction[];
}

/** Run photo and/or sound ID in parallel, then fuse the results. */
export async function identifySession({
  photoUri,
  audioUri,
  skipPhotoAuthenticity = false,
  photoBase64,
}: {
  photoUri: string;
  audioUri?: string | null;
  skipPhotoAuthenticity?: boolean;
  photoBase64?: string | null;
}): Promise<SessionIdentification> {
  let imagePredictions: Prediction[] = [];
  let audioPredictions: Prediction[] = [];
  let count = 1;

  const [imageResult, audioResult] = await Promise.allSettled([
    identifyImage(photoUri, { skipAuthenticity: skipPhotoAuthenticity, base64: photoBase64 }),
    audioUri ? identifyAudio(audioUri) : Promise.resolve(null),
  ]);

  if (imageResult.status === "fulfilled") {
    imagePredictions = imageResult.value.predictions;
    count = imageResult.value.count;
  } else {
    throw imageResult.reason;
  }

  if (audioResult.status === "fulfilled" && audioResult.value) {
    audioPredictions = audioResult.value.predictions;
  }

  const fused = fusePredictions(imagePredictions, audioPredictions);
  return {
    ...fused,
    count,
    imagePredictions,
    audioPredictions,
  };
}
