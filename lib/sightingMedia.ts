export function isAudioSighting(sighting: {
  audio_url?: string | null;
}): boolean {
  return Boolean(sighting.audio_url);
}

export function isPhotoSighting(sighting: {
  photo_url?: string | null;
  audio_url?: string | null;
}): boolean {
  return Boolean(sighting.photo_url) && !sighting.audio_url;
}

/** True when a sighting has attached audio (standalone or with photos). */
export function sightingHasAttachedAudio(sighting: {
  audio_url?: string | null;
}): boolean {
  return Boolean(sighting.audio_url?.trim());
}

export function sightingHasPhoto(sighting: {
  photo_url?: string | null;
}): boolean {
  return Boolean(sighting.photo_url?.trim());
}

/** Photo + audio on the same post. */
export function isCombinedMediaSighting(sighting: {
  photo_url?: string | null;
  audio_url?: string | null;
}): boolean {
  return sightingHasPhoto(sighting) && sightingHasAttachedAudio(sighting);
}

/** Hero area shows the photo carousel (photo-only or photo+audio). */
export function sightingHeroIsPhoto(sighting: {
  photo_url?: string | null;
}): boolean {
  return sightingHasPhoto(sighting);
}

/** Hero area shows the waveform (audio-only posts). */
export function sightingHeroIsAudio(sighting: {
  photo_url?: string | null;
  audio_url?: string | null;
}): boolean {
  return sightingHasAttachedAudio(sighting) && !sightingHasPhoto(sighting);
}
