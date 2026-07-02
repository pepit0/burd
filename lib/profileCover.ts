const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=200&fit=crop&auto=format`;

export const PROFILE_COVER_PRESETS = [
  {
    id: "forest",
    label: "Misty forest",
    url: UNSPLASH("photo-1448375240586-882707db888b"),
  },
  {
    id: "alpine",
    label: "Alpine lake",
    url: UNSPLASH("photo-1506905925346-21bda4d32df4"),
  },
  {
    id: "meadow",
    label: "Wildflower meadow",
    url: UNSPLASH("photo-1465146633011-14f8e0781093"),
  },
  {
    id: "coast",
    label: "Sunset coast",
    url: UNSPLASH("photo-1505142468610-359e7d316be0"),
  },
  {
    id: "wetland",
    label: "Quiet wetland",
    url: UNSPLASH("photo-1501785888041-af3ef285b470"),
  },
] as const;

export type ProfileCoverPresetId = (typeof PROFILE_COVER_PRESETS)[number]["id"];

export const DEFAULT_PROFILE_COVER_PRESET_ID: ProfileCoverPresetId = "forest";

export const DEFAULT_PROFILE_COVER = PROFILE_COVER_PRESETS[0].url;

export function profileCoverPreset(id: string) {
  return PROFILE_COVER_PRESETS.find((preset) => preset.id === id);
}

export function profileCoverUri(coverUrl?: string | null): string {
  const value = coverUrl?.trim();
  if (!value) return DEFAULT_PROFILE_COVER;
  const preset = profileCoverPreset(value);
  if (preset) return preset.url;
  return value;
}

export function profileCoverPresetId(coverUrl?: string | null): ProfileCoverPresetId {
  const value = coverUrl?.trim();
  if (!value) return DEFAULT_PROFILE_COVER_PRESET_ID;
  const preset = profileCoverPreset(value);
  return preset?.id ?? DEFAULT_PROFILE_COVER_PRESET_ID;
}
