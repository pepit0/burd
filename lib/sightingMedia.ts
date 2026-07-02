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
