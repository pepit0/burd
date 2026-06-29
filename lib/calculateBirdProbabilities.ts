export interface RawPrediction {
  speciesCode: string;
  logit: number;
}

export interface BirdProbability {
  speciesCode: string;
  confidence: number;
  confidencePercentage: number;
}

export const DEFAULT_SOUND_SOFTMAX_TEMPERATURE = 0.6;
export const DEFAULT_SOUND_DISPLAY_TOP_K = 5;

export function calculateBirdProbabilities(
  rawPredictions: RawPrediction[],
  validSpeciesCodes: string[],
  temperature: number = DEFAULT_SOUND_SOFTMAX_TEMPERATURE,
  topK: number = DEFAULT_SOUND_DISPLAY_TOP_K,
): BirdProbability[] {
  const safeValidCodes = new Set(
    validSpeciesCodes.map((code) => code.toLowerCase().trim()),
  );

  const maskedPredictions = rawPredictions.map((pred) => ({
    ...pred,
    logit: safeValidCodes.has(pred.speciesCode.toLowerCase().trim())
      ? pred.logit
      : Number.NEGATIVE_INFINITY,
  }));

  maskedPredictions.sort((a, b) => b.logit - a.logit);

  const topCandidates = maskedPredictions.slice(0, topK);

  if (topCandidates.length === 0 || topCandidates[0].logit === Number.NEGATIVE_INFINITY) {
    return [];
  }

  const scaledLogits = topCandidates.map((candidate) => candidate.logit / temperature);
  const maxLogit = Math.max(...scaledLogits);
  const exponents = scaledLogits.map((logit) => Math.exp(logit - maxLogit));
  const sumExp = exponents.reduce((acc, value) => acc + value, 0);

  return topCandidates.map((pred, index) => ({
    speciesCode: pred.speciesCode,
    confidence: exponents[index] / sumExp,
    confidencePercentage: Math.round((exponents[index] / sumExp) * 100),
  }));
}
