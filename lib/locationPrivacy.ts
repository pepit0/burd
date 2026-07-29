import * as Location from "expo-location";
import {
  abbreviateAdministrativeRegion,
  applyGeocodeFields,
  cityFromGeocode,
  isLikelyStreetAddress,
} from "@/lib/geocode";
import type { Sighting, SightingVisibility } from "@/types";

/** ~1.1 km grid — neighborhood-level, not a precise pin. */
const PUBLIC_COORD_DECIMALS = 2;

export function canViewPreciseSightingLocation(
  sighting: Sighting,
  viewerUserId: string | null | undefined,
): boolean {
  return Boolean(viewerUserId && viewerUserId === sighting.user_id);
}

export function publicLocationName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed || isLikelyStreetAddress(trimmed)) return null;
  return trimmed;
}

function obfuscateCoordinate(
  value: number | null | undefined,
  decimals: number,
): number | null {
  if (value == null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** City + optional place label safe to show other users. */
export function publicSightingArea(sighting: Sighting): string | null {
  const city = sighting.location_city?.trim();
  const place = publicLocationName(sighting.location_name);

  if (place && city && place.toLowerCase() !== city.toLowerCase()) {
    return `${place}, ${city}`;
  }
  if (place) return place;
  if (city) return city;
  return null;
}

async function districtFromObfuscatedCoords(
  latitude: number,
  longitude: number,
): Promise<{ district: string | null; city: string | null; region: string | null }> {
  const lat = obfuscateCoordinate(latitude, PUBLIC_COORD_DECIMALS);
  const lng = obfuscateCoordinate(longitude, PUBLIC_COORD_DECIMALS);
  if (lat == null || lng == null) {
    return { district: null, city: null, region: null };
  }

  try {
    const geo = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    const place = geo[0];
    if (!place) return { district: null, city: null, region: null };

    const city = cityFromGeocode(place) || applyGeocodeFields(place).city || null;
    const district = place.district?.trim() || null;
    const region = place.region?.trim() || null;
    return { district, city, region };
  } catch {
    return { district: null, city: null, region: null };
  }
}

/** Neighborhood-level label for viewers who are not the poster. */
export async function resolvePublicSightingArea(
  sighting: Sighting,
): Promise<string> {
  const stored = publicSightingArea(sighting);
  if (stored) return stored;

  const lat = sighting.public_latitude ?? sighting.latitude;
  const lng = sighting.public_longitude ?? sighting.longitude;

  if (lat == null || lng == null) {
    return "Unknown area";
  }

  const { district, city, region } = await districtFromObfuscatedCoords(lat, lng);

  if (district && city && district.toLowerCase() !== city.toLowerCase()) {
    return region
      ? `${district}, ${city}, ${abbreviateAdministrativeRegion(region)}`
      : `${district}, ${city}`;
  }
  if (city && region) {
    return `${city}, ${abbreviateAdministrativeRegion(region)}`;
  }
  if (city) return city;
  if (district) return district;

  return "Unknown area";
}

/** Strip precise location fields before returning sightings to other users. */
export async function redactSightingLocation<T extends Sighting>(
  sighting: T,
  viewerUserId: string | null | undefined,
): Promise<T> {
  if (canViewPreciseSightingLocation(sighting, viewerUserId)) {
    return sighting;
  }

  let locationCity = sighting.location_city;
  let locationName = publicLocationName(sighting.location_name);

  const refLat = sighting.public_latitude ?? sighting.latitude;
  const refLng = sighting.public_longitude ?? sighting.longitude;

  if (!publicSightingArea(sighting) && refLat != null && refLng != null) {
    const { district, city } = await districtFromObfuscatedCoords(refLat, refLng);
    if (city && !locationCity?.trim()) {
      locationCity = city;
    }
    if (district && !locationName) {
      locationName = district;
    }
  }

  return {
    ...sighting,
    latitude: sighting.public_latitude ?? null,
    longitude: sighting.public_longitude ?? null,
    location_address: null,
    location_city: locationCity,
    location_name: locationName,
  };
}

export function redactSightingLocations<T extends Sighting>(
  sightings: T[],
  viewerUserId: string | null | undefined,
): Promise<T[]> {
  return Promise.all(
    sightings.map((sighting) => redactSightingLocation(sighting, viewerUserId)),
  );
}

export function effectiveVisibility(
  sighting: Sighting,
  profileDefault: SightingVisibility = "public",
): SightingVisibility {
  return sighting.visibility ?? profileDefault;
}

export function isLocationObscured(sighting: Sighting): boolean {
  return sighting.location_obscured_reason != null;
}
