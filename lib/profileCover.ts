const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&h=200&fit=crop&auto=format`;

export const PROFILE_COVER_PRESETS = [
  {
    id: "forest",
    url: UNSPLASH("photo-1448375240586-882707db888b"),
  },
  {
    id: "alpine",
    url: UNSPLASH("photo-1506905925346-21bda4d32df4"),
  },
  {
    id: "meadow",
    url: UNSPLASH("photo-1765195185934-bfc4dc6e0ee0"),
  },
  {
    id: "coast",
    url: UNSPLASH("photo-1505142468610-359e7d316be0"),
  },
  {
    id: "wetland",
    url: UNSPLASH("photo-1501785888041-af3ef285b470"),
  },
  {
    id: "sunset-blaze",
    url: UNSPLASH("photo-1470071459604-3b5ec3a7fe05"),
  },
  {
    id: "aurora",
    url: UNSPLASH("photo-1483347756197-71ef80e95f73"),
  },
  {
    id: "lavender",
    url: UNSPLASH("photo-1472214103451-9374bd1c798e"),
  },
  {
    id: "cherry-blossom",
    url: UNSPLASH("photo-1522383225653-ed111181a951"),
  },
  {
    id: "tropical-lagoon",
    url: UNSPLASH("photo-1507525428034-b723cf961d3e"),
  },
  {
    id: "forest-trail",
    url: UNSPLASH("photo-1441974231531-c6227db76b6e"),
  },
  {
    id: "misty-pines",
    url: UNSPLASH("photo-1426604966848-d7adac402bff"),
  },
  {
    id: "jungle-waterfall",
    url: UNSPLASH("photo-1500477204083-d397613d033b"),
  },
  {
    id: "sunlit-peaks",
    url: UNSPLASH("photo-1469474968028-56623f02e42e"),
  },
  {
    id: "lakeside-dock",
    url: UNSPLASH("photo-1439066615861-d1af74d74000"),
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
