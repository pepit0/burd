/** Shared chirp synthesis params — ported from Pocket Bird `src/sound.js`. */

import { encode as encodeBase64 } from "base64-arraybuffer";

export const CHIRP_TIMES = [0, 0.06, 0.1, 0.15] as const;
export const CHIRP_VOLUMES = [0.00005, 0.165, 0.165, 0.0001] as const;
/** Native PCM synthesis needs a louder master gain than Web Audio envelopes. */
export const PCM_MASTER_GAIN = 2.5;

export function chirpBurstCount(): number {
  return Math.floor(1 + Math.random() * 1.5);
}

export function chirpFrequencies(count: number): number[] {
  return [
    2200,
    3500 + Math.random() * 600 * count,
    2100 + Math.random() * 200 * count,
    1600 + Math.random() * 400 * count,
  ];
}

/** Exponential ramp between keyframes (matches Web Audio `exponentialRampToValueAtTime`). */
export function rampValue(
  times: readonly number[],
  values: readonly number[],
  t: number,
): number {
  if (t <= times[0]!) return values[0]!;
  const last = times.length - 1;
  if (t >= times[last]!) return values[last]!;

  for (let i = 0; i < last; i++) {
    const t0 = times[i]!;
    const t1 = times[i + 1]!;
    if (t >= t0 && t <= t1) {
      const v0 = values[i]!;
      const v1 = values[i + 1]!;
      if (v0 === 0 || v1 === 0) {
        const ratio = (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * ratio;
      }
      const ratio = (t - t0) / (t1 - t0);
      return v0 * (v1 / v0) ** ratio;
    }
  }
  return values[last]!;
}

export function encodeWavBase64(samples: Int16Array, sampleRate: number): string {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i]!, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  return encodeBase64(bytes.buffer);
}

export function synthesizeChirpPcm(sampleRate = 44100): Int16Array {
  const count = chirpBurstCount();
  const gapSec = 0.12;
  const chirpDuration = CHIRP_TIMES[CHIRP_TIMES.length - 1]!;
  const totalSec = chirpDuration + (count - 1) * gapSec;
  const float = new Float32Array(Math.ceil(totalSec * sampleRate));

  for (let c = 0; c < count; c++) {
    const frequencies = chirpFrequencies(count);
    const startSample = Math.floor(c * gapSec * sampleRate);
    const chirpSamples = Math.ceil(chirpDuration * sampleRate);
    let phase = 0;

    for (let i = 0; i < chirpSamples; i++) {
      const t = i / sampleRate;
      const freq = rampValue(CHIRP_TIMES, frequencies, t);
      const vol = rampValue(CHIRP_TIMES, CHIRP_VOLUMES, t);
      phase += (2 * Math.PI * freq) / sampleRate;
      float[startSample + i]! += Math.sin(phase) * vol * PCM_MASTER_GAIN;
    }
  }

  const pcm = new Int16Array(float.length);
  for (let i = 0; i < float.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float[i]!));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}
