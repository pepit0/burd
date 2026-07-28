/** Derive pseudo pitch / timbre features from mic level history (no on-device FFT). */

export interface SoundSpaceSample {
  timbre: number;
  pitch: number;
  amplitude: number;
  hz: number;
}

const HISTORY_MAX = 72;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function zeroCrossings(values: number[], pivot = 0.32): number {
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    const prev = values[index - 1] - pivot;
    const next = values[index] - pivot;
    if (prev * next < 0) count += 1;
  }
  return count;
}

function slopeEnergy(values: number[]): number {
  let energy = 0;
  for (let index = 1; index < values.length; index += 1) {
    energy += Math.abs(values[index] - values[index - 1]);
  }
  return energy / Math.max(1, values.length - 1);
}

export function analyzeLevelHistory(levels: number[]): SoundSpaceSample {
  const recent = levels.slice(-24);
  const amplitude = recent[recent.length - 1] ?? 0;

  if (recent.length < 3) {
    return { timbre: 0.5, pitch: 0.5, amplitude, hz: 0 };
  }

  const crossings = zeroCrossings(recent);
  const pitchRaw =
    crossings / 10 + slopeEnergy(recent) * 2.4 + amplitude * 0.35;
  const pitch = Math.max(0, Math.min(1, pitchRaw));

  const spread = Math.sqrt(variance(recent));
  const timbreRaw =
    spread * 4.2 + Math.abs(recent[recent.length - 1] - recent[0]) * 1.6;
  const timbre = Math.max(0, Math.min(1, timbreRaw));

  const hz = amplitude > 0.04 ? 220 + pitch * 4200 + spread * 900 : 0;

  return { timbre, pitch, amplitude, hz };
}

/** Build one spectrogram time column (called once per mic sample). */
export function buildSpectrogramColumn(
  levels: readonly number[],
  index: number,
  freqBins: number,
): number[] {
  const amp = levels[index];
  const slice = levels.slice(Math.max(0, index - 6), index + 1);
  const sample = analyzeLevelHistory(slice);
  const pitchCenter = sample.pitch;
  const spread = Math.sqrt(variance(slice)) * 2.8 + 0.08;

  const bins = new Array<number>(freqBins);
  for (let bin = 0; bin < freqBins; bin += 1) {
    const freq = bin / (freqBins - 1);
    const dist = Math.abs(freq - pitchCenter);
    const energy =
      amp *
      Math.exp(-(dist * dist) / (spread * spread + 0.015)) *
      (0.65 + 0.35 * Math.abs(Math.sin((index + bin) * 0.42)));
    bins[bin] = energy > 0.04 ? Math.min(1, energy) : 0;
  }
  return bins;
}

export class LiveSoundFeatureStream {
  private levels: number[] = [];
  private columns: number[][] = [];
  private readonly freqBins: number;

  constructor(freqBins = 24) {
    this.freqBins = freqBins;
  }

  reset(): void {
    this.levels = [];
    this.columns = [];
  }

  push(level: number): SoundSpaceSample {
    this.levels.push(level);
    if (this.levels.length > HISTORY_MAX) {
      this.levels.shift();
      this.columns.shift();
    }
    const index = this.levels.length - 1;
    this.columns.push(
      buildSpectrogramColumn(this.levels, index, this.freqBins),
    );
    return analyzeLevelHistory(this.levels);
  }

  getLevels(): readonly number[] {
    return this.levels;
  }

  getColumns(): readonly number[][] {
    return this.columns;
  }
}
