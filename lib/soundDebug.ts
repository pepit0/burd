/** Enable with EXPO_PUBLIC_SOUND_DEBUG=true in .env (dev only). */
export const SOUND_DEBUG =
  __DEV__ && process.env.EXPO_PUBLIC_SOUND_DEBUG === "true";

/** Show Perch confidence % on the live Sound ID list (mirrors server AUDIO_DEBUG). */
export const SHOW_LIVE_SOUND_CONFIDENCE = SOUND_DEBUG;

export function logSoundDebug(
  stage: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!SOUND_DEBUG) return;
  if (data) {
    console.log(`[SoundID:${stage}] ${message}`, data);
  } else {
    console.log(`[SoundID:${stage}] ${message}`);
  }
}
