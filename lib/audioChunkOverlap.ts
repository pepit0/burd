import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { encode } from "base64-arraybuffer";
import { readLocalFileBytes } from "@/lib/localFileBytes";

/** Perch analyzes ~5s windows. */
export const LIVE_WINDOW_MS = 5000;
/** How often to rotate the mic buffer and send for analysis. */
export const LIVE_ROTATE_MS = 2500;
export const LIVE_OVERLAP_MS = LIVE_WINDOW_MS - LIVE_ROTATE_MS;

const IOS_PCM_SAMPLE_RATE = 44100;
const WAV_HEADER_BYTES = 44;

export function supportsOverlappedLiveChunks(): boolean {
  return Platform.OS === "ios" || Platform.OS === "web";
}

function isWavBytes(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  const view = new Uint8Array(bytes, 0, 4);
  return (
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46
  );
}

function pcmByteLength(bytes: ArrayBuffer): number {
  return Math.max(0, bytes.byteLength - WAV_HEADER_BYTES);
}

function tailPcmBytes(
  bytes: ArrayBuffer,
  tailMs: number,
  sampleRate = IOS_PCM_SAMPLE_RATE,
): Uint8Array {
  const pcmLen = pcmByteLength(bytes);
  if (pcmLen <= 0) return new Uint8Array(0);
  const pcm = new Uint8Array(bytes, WAV_HEADER_BYTES, pcmLen);
  const tailBytes = Math.min(
    pcm.length,
    Math.floor((tailMs / 1000) * sampleRate * 2),
  );
  return pcm.subarray(pcm.length - tailBytes);
}

function buildWavFromPcm(
  pcm: Uint8Array,
  sampleRate = IOS_PCM_SAMPLE_RATE,
): ArrayBuffer {
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + pcm.length);
  const view = new DataView(buffer);

  const writeStr = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, WAV_HEADER_BYTES).set(pcm);
  return buffer;
}

/**
 * Build a ~5s overlapping analyze clip from the tail of the previous segment
 * and the current segment (iOS linear PCM WAV). Falls back to current on Android AAC.
 */
export async function buildOverlappedAnalyzeUri(
  previousUri: string | null,
  currentUri: string,
  currentDurationMs: number,
): Promise<{ uri: string; durationMs: number }> {
  if (!supportsOverlappedLiveChunks() || !previousUri) {
    return { uri: currentUri, durationMs: currentDurationMs };
  }

  try {
    const [prevBytes, curBytes] = await Promise.all([
      readLocalFileBytes(previousUri),
      readLocalFileBytes(currentUri),
    ]);
    if (!isWavBytes(prevBytes) || !isWavBytes(curBytes)) {
      return { uri: currentUri, durationMs: currentDurationMs };
    }

    const tail = tailPcmBytes(prevBytes, LIVE_OVERLAP_MS);
    const curPcmLen = pcmByteLength(curBytes);
    const curPcm = new Uint8Array(curBytes, WAV_HEADER_BYTES, curPcmLen);
    const merged = new Uint8Array(tail.length + curPcm.length);
    merged.set(tail, 0);
    merged.set(curPcm, tail.length);

    const wav = buildWavFromPcm(merged);
    const outPath = `${FileSystem.cacheDirectory}live-overlap-${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(outPath, encode(wav), {
      encoding: FileSystem.EncodingType.Base64,
    });
    const durationMs = Math.round((merged.length / 2 / IOS_PCM_SAMPLE_RATE) * 1000);
    return { uri: outPath, durationMs };
  } catch {
    return { uri: currentUri, durationMs: currentDurationMs };
  }
}

/** Rotate interval: overlapping on iOS, full 5s windows on Android AAC. */
export function liveRotateIntervalMs(): number {
  return supportsOverlappedLiveChunks() ? LIVE_ROTATE_MS : LIVE_WINDOW_MS;
}
