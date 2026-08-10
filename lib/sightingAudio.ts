import type { Sighting, PostAudioTrim } from "@/types";

export interface AudioPlaybackTrimOptions {
  trimStartMs: number;
  trimEndMs: number;
}

export type { PostAudioTrim };

export const MIN_POST_AUDIO_TRIM_MS = 1000;
export const POST_AUDIO_TRIM_TOLERANCE_MS = 80;

export function getPostAudioTrim(sighting: {
  published_at?: string | null;
  published_audio_start_ms?: number | null;
  published_audio_end_ms?: number | null;
}): PostAudioTrim | null {
  if (!sighting.published_at) return null;
  if (
    sighting.published_audio_start_ms == null ||
    sighting.published_audio_end_ms == null
  ) {
    return null;
  }
  if (sighting.published_audio_end_ms <= sighting.published_audio_start_ms) {
    return null;
  }
  return {
    startMs: sighting.published_audio_start_ms,
    endMs: sighting.published_audio_end_ms,
  };
}

export function isFullClipTrim(
  startMs: number,
  endMs: number,
  durationMs: number,
): boolean {
  if (durationMs <= 0) return true;
  return (
    startMs <= POST_AUDIO_TRIM_TOLERANCE_MS &&
    endMs >= durationMs - POST_AUDIO_TRIM_TOLERANCE_MS
  );
}

export function normalizePostAudioTrim(
  startMs: number,
  endMs: number,
  durationMs: number,
): PostAudioTrim | null {
  if (durationMs <= 0) return null;

  const start = Math.max(0, Math.min(startMs, durationMs));
  const end = Math.max(start + MIN_POST_AUDIO_TRIM_MS, Math.min(endMs, durationMs));

  if (isFullClipTrim(start, end, durationMs)) {
    return null;
  }

  return { startMs: start, endMs: end };
}

export function postAudioPlaybackOptions(
  sighting: Pick<
    Sighting,
    "published_at" | "published_audio_start_ms" | "published_audio_end_ms"
  >,
): AudioPlaybackTrimOptions | undefined {
  const trim = getPostAudioTrim(sighting);
  if (!trim) return undefined;
  return {
    trimStartMs: trim.startMs,
    trimEndMs: trim.endMs,
  };
}

export function formatTrimDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
