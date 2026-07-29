import type { DistanceUnit, LocationObscuredReason, SightingVisibility } from "@/types";
import { sensitiveSpeciesMinFuzzKm } from "@/lib/sensitiveSpecies";

export const FUZZ_KM_OPTIONS = [0, 1, 5, 10, 25] as const;
export type FuzzKmOption = (typeof FUZZ_KM_OPTIONS)[number];

export const VISIBILITY_OPTIONS: { id: SightingVisibility; label: string; desc: string }[] = [
  { id: "public", label: "Public", desc: "Anyone on Burd can see published posts" },
  { id: "friends", label: "Friends only", desc: "Only mutual friends can see published posts" },
  { id: "private", label: "Private", desc: "Journal only — not shared on your profile or feed" },
];

export interface LocationPolicyInput {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  shareExactCoordinates: boolean;
  locationFuzzKm: number;
  scientificName?: string | null;
  species?: string | null;
}

export interface LocationPolicyResult {
  publicLatitude: number | null;
  publicLongitude: number | null;
  effectiveFuzzKm: number;
  locationObscuredReason: LocationObscuredReason | null;
  isSensitiveSpecies: boolean;
}

/** Grid obfuscation — fuzz_km 0 means owner-only precise (public coords = exact). */
export function computePublicCoordinates(
  latitude: number,
  longitude: number,
  fuzzKm: number,
): { lat: number; lng: number } {
  if (fuzzKm <= 0) {
    return { lat: latitude, lng: longitude };
  }
  const step = fuzzKm / 111;
  return {
    lat: Math.round(latitude / step) * step,
    lng: Math.round(longitude / step) * step,
  };
}

export function effectiveLocationPolicy(input: LocationPolicyInput): LocationPolicyResult {
  const lat = input.latitude ?? null;
  const lng = input.longitude ?? null;

  if (lat == null || lng == null) {
    return {
      publicLatitude: null,
      publicLongitude: null,
      effectiveFuzzKm: input.locationFuzzKm,
      locationObscuredReason: null,
      isSensitiveSpecies: false,
    };
  }

  const sensitiveMin = sensitiveSpeciesMinFuzzKm(input.scientificName, input.species);
  const isSensitive = sensitiveMin != null;

  let effectiveFuzzKm = input.locationFuzzKm;
  let locationObscuredReason: LocationObscuredReason | null = null;

  if (isSensitive && sensitiveMin != null) {
    effectiveFuzzKm = Math.max(effectiveFuzzKm, sensitiveMin);
    locationObscuredReason = "sensitive_species";
  } else if (!input.shareExactCoordinates || effectiveFuzzKm > 0) {
    locationObscuredReason = "user_setting";
  }

  if (!input.shareExactCoordinates && effectiveFuzzKm === 0) {
    effectiveFuzzKm = 1;
    locationObscuredReason = locationObscuredReason ?? "user_setting";
  }

  const { lat: publicLatitude, lng: publicLongitude } = computePublicCoordinates(
    lat,
    lng,
    effectiveFuzzKm,
  );

  return {
    publicLatitude,
    publicLongitude,
    effectiveFuzzKm,
    locationObscuredReason,
    isSensitiveSpecies: isSensitive,
  };
}

export function fuzzKmLabel(km: number, unit: DistanceUnit = "km"): string {
  if (km === 0) return "Off (owner only)";
  if (unit === "mi") {
    const mi = km * 0.621371;
    return mi >= 10 ? `~${Math.round(mi)} mi` : `~${mi.toFixed(1)} mi`;
  }
  return km >= 10 ? `~${km} km` : `~${km} km`;
}

export function visibilityLabel(v: SightingVisibility): string {
  return VISIBILITY_OPTIONS.find((o) => o.id === v)?.label ?? v;
}
