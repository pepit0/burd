const peakCache = new Map<string, number[]>();

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRand(seed: number, index: number): number {
  const x = Math.sin(seed * 9999 + index * 127.1) * 10000;
  return x - Math.floor(x);
}

export function seededFallbackPeaks(uri: string, barCount: number): number[] {
  const base = hashSeed(uri);
  const peaks = Array.from({ length: barCount }, (_, index) => {
    const a = pseudoRand(base, index);
    const b = pseudoRand(base + 13, index * 3);
    return 0.12 + a * 0.55 + b * 0.2;
  });
  const highest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / highest);
}

export function computePeaks(samples: Float32Array, barCount: number): number[] {
  if (samples.length === 0) {
    return Array.from({ length: barCount }, () => 0.15);
  }

  const blockSize = Math.max(1, Math.floor(samples.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(samples.length, start + blockSize);
    for (let j = start; j < end; j += 1) {
      max = Math.max(max, Math.abs(samples[j]));
    }
    peaks.push(max);
  }

  const highest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => Math.max(0.08, peak / highest));
}

export function synthesizeLiveLevels(
  peaks: number[],
  positionMs: number,
  durationMs: number,
  barCount: number,
): number[] {
  if (durationMs <= 0) {
    return Array.from({ length: barCount }, () => 0.12);
  }

  const source = peaks.length > 0 ? peaks : Array.from({ length: barCount }, () => 0.2);
  const playhead = (positionMs / durationMs) * barCount;
  const tick = Date.now() / 100;

  return Array.from({ length: barCount }, (_, index) => {
    const peakIndex = Math.min(
      source.length - 1,
      Math.floor((index / Math.max(barCount - 1, 1)) * (source.length - 1)),
    );
    const peak = source[peakIndex] ?? 0.2;
    const dist = Math.abs(index - playhead);
    const window = Math.max(0, 1 - dist / 3.5);
    const wobble = 0.55 + 0.45 * Math.sin(tick + index * 0.9);
    const energy = peak * (0.2 + window * 0.8) * wobble;
    return Math.min(1, Math.max(0.12, energy));
  });
}

function isWav(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new DataView(bytes);
  return (
    view.getUint32(0, false) === 0x52494646 &&
    view.getUint32(8, false) === 0x57415645
  );
}

function peaksFromWav(bytes: ArrayBuffer, barCount: number): number[] | null {
  const view = new DataView(bytes);
  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;

    if (chunkId === 0x666d7420) {
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (chunkId === 0x64617461) {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize <= 0) return null;
  if (audioFormat !== 1 || bitsPerSample !== 16) return null;

  const frameCount = Math.floor(dataSize / (channels * 2));
  if (frameCount <= 0) return null;

  const blockSize = Math.max(1, Math.floor(frameCount / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    let max = 0;
    const startFrame = i * blockSize;
    const endFrame = Math.min(frameCount, startFrame + blockSize);
    for (let frame = startFrame; frame < endFrame; frame += 1) {
      let sampleMax = 0;
      for (let ch = 0; ch < channels; ch += 1) {
        const sampleOffset = dataOffset + (frame * channels + ch) * 2;
        if (sampleOffset + 1 >= bytes.byteLength) continue;
        const sample = view.getInt16(sampleOffset, true) / 32768;
        sampleMax = Math.max(sampleMax, Math.abs(sample));
      }
      max = Math.max(max, sampleMax);
    }
    peaks.push(max);
  }

  const highest = Math.max(...peaks, 0.001);
  return peaks.map((peak) => Math.max(0.08, peak / highest));
}

async function fetchAudioBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not load audio.");
  }
  return response.arrayBuffer();
}

async function peaksFromWebAudio(bytes: ArrayBuffer, barCount: number): Promise<number[]> {
  const AudioCtx =
    typeof globalThis.AudioContext !== "undefined"
      ? globalThis.AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    throw new Error("Web Audio is unavailable.");
  }

  const context = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    return computePeaks(buffer.getChannelData(0), barCount);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function loadAudioPeaks(uri: string, barCount: number): Promise<number[]> {
  const cacheKey = `${uri}:${barCount}`;
  const cached = peakCache.get(cacheKey);
  if (cached) return cached;

  try {
    const bytes = await fetchAudioBytes(uri);
    let peaks: number[] | null = null;

    if (isWav(bytes)) {
      peaks = peaksFromWav(bytes, barCount);
    }

    if (!peaks) {
      try {
        peaks = await peaksFromWebAudio(bytes, barCount);
      } catch {
        peaks = null;
      }
    }

    const resolved = peaks ?? seededFallbackPeaks(uri, barCount);
    peakCache.set(cacheKey, resolved);
    return resolved;
  } catch {
    const resolved = seededFallbackPeaks(uri, barCount);
    peakCache.set(cacheKey, resolved);
    return resolved;
  }
}
