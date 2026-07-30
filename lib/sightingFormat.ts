import * as Location from "expo-location";
import {
  applyGeocodeFields,
  abbreviateAdministrativeRegion,
  isLikelyStreetAddress,
  parseCityFromAddressString,
  parseRegionFromAddressString,
  stripCountryFromPlaceString,
} from "@/lib/geocode";
import type { Sighting } from "@/types";

/** When the bird / photo was observed (EXIF or capture time). Use on detail screens. */
export function observedDate(sighting: Sighting): Date {
  return new Date(sighting.observed_at ?? sighting.created_at);
}

/** When a post appeared on the feed or profile. Use for cards and post headers. */
export function postedDate(sighting: Sighting): Date {
  return new Date(sighting.published_at ?? sighting.created_at);
}

/** When the journal entry was added. Use for journal list sort, grouping, and row dates. */
export function journalLogDate(sighting: Sighting): Date {
  return new Date(sighting.created_at);
}

function cityFromStoredFields(sighting: Sighting): string | null {
  const stored = sighting.location_city?.trim();
  if (stored) {
    if (isLikelyStreetAddress(stored)) {
      return parseCityFromAddressString(stored);
    }
    return stored;
  }

  const address = sighting.location_address?.trim();
  if (address) {
    const parsed = parseCityFromAddressString(address);
    if (parsed) return parsed;
  }

  const name = sighting.location_name?.trim();
  if (name) {
    const fromName = parseCityFromAddressString(name);
    if (fromName) return fromName;
    if (!isLikelyStreetAddress(name)) return name;
  }

  return null;
}

/** City/town + province/state for feed cards (no country). */
export function sightingPlaceLine(sighting: Sighting): string | null {
  const city = cityFromStoredFields(sighting);
  const regionSource =
    sighting.location_address?.trim() || sighting.location_name?.trim() || "";
  const region = regionSource ? parseRegionFromAddressString(regionSource) : null;

  if (city && region) {
    return `${city}, ${abbreviateAdministrativeRegion(region)}`;
  }
  if (city) return city;

  const name = sighting.location_name?.trim();
  if (!name) return null;

  if (name.includes(",")) {
    return stripCountryFromPlaceString(name);
  }

  return isLikelyStreetAddress(name) ? null : name;
}

/** City/town for journal list rows (sync — uses saved fields only). */
export function sightingCity(sighting: Sighting): string {
  return cityFromStoredFields(sighting) ?? "Unknown location";
}

/** Resolve city from GPS when saved fields are missing or incomplete. */
export async function resolveSightingCity(sighting: Sighting): Promise<string> {
  const stored = cityFromStoredFields(sighting);
  if (stored) return stored;

  if (sighting.latitude == null || sighting.longitude == null) {
    return "Unknown location";
  }

  try {
    const geo = await Location.reverseGeocodeAsync({
      latitude: sighting.latitude,
      longitude: sighting.longitude,
    });
    const place = geo[0];
    if (!place) return "Unknown location";

    const { city } = applyGeocodeFields(place);
    return city || "Unknown location";
  } catch {
    return "Unknown location";
  }
}

/** Full address for detail view. */
export function sightingAddress(sighting: Sighting): string | null {
  if (sighting.location_address?.trim()) {
    return sighting.location_address.trim();
  }

  const name = sighting.location_name?.trim();
  if (name && isLikelyStreetAddress(name)) {
    return name;
  }

  if (sighting.latitude != null && sighting.longitude != null) {
    return `${sighting.latitude.toFixed(5)}, ${sighting.longitude.toFixed(5)}`;
  }

  return null;
}

export async function resolveSightingAddress(
  sighting: Sighting,
): Promise<string | null> {
  const stored = sightingAddress(sighting);
  if (stored && !stored.match(/^-?\d+\.\d+, -?\d+\.\d+$/)) {
    return stored;
  }

  if (sighting.latitude == null || sighting.longitude == null) {
    return stored;
  }

  try {
    const geo = await Location.reverseGeocodeAsync({
      latitude: sighting.latitude,
      longitude: sighting.longitude,
    });
    const place = geo[0];
    if (!place) return stored;

    const { address } = applyGeocodeFields(place);
    return address || stored;
  } catch {
    return stored;
  }
}

export function formatJournalWhen(date: Date): string {
  const datePart = formatJournalEntryDatePart(date);
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function formatJournalEntryDatePart(date: Date, now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  if (date >= cutoff) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Journal entry detail — month/day only when observed within the past year. */
export function formatJournalEntryDate(date: Date, now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  if (date >= cutoff) {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDetailDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDetailTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
