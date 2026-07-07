import type { LocationGeocodedAddress } from "expo-location";

const COUNTRY_NAMES = new Set([
  "united states",
  "united states of america",
  "usa",
  "u.s.a.",
  "u.s.",
  "canada",
  "mexico",
  "united kingdom",
  "uk",
]);

const STREET_SUFFIX =
  /\b(street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|highway|hwy\.?|parkway|pkwy\.?|place|pl\.?|way)\s*$/i;

function looksLikeStreet(text: string): boolean {
  const t = text.trim();
  if (/^\d+\s+\S/.test(t)) return true;
  return STREET_SUFFIX.test(t);
}

function isStateOrZip(part: string): boolean {
  const p = part.trim();
  if (/^\d{5}(-\d{4})?$/.test(p)) return true;
  if (/^[A-Z]{2}$/.test(p)) return true;
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}(\s+\d{5})?$/.test(p)) return true;
  return false;
}

function isCountry(part: string): boolean {
  return COUNTRY_NAMES.has(part.trim().toLowerCase());
}

/** Extract city/town from a comma-separated address string. */
export function parseCityFromAddressString(formatted: string): string | null {
  const parts = formatted
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const start = looksLikeStreet(parts[0]) ? 1 : 0;

  for (let i = start; i < parts.length; i++) {
    const part = parts[i];
    if (isStateOrZip(part) || isCountry(part)) {
      if (part.includes(",")) {
        const cityPart = part.split(",")[0]?.trim();
        if (cityPart && !looksLikeStreet(cityPart)) return cityPart;
      }
      continue;
    }
    if (looksLikeStreet(part)) continue;
    return part;
  }

  if (parts.length >= 2 && looksLikeStreet(parts[0])) {
    const candidate = parts[1];
    if (candidate && !isStateOrZip(candidate) && !looksLikeStreet(candidate)) {
      return candidate;
    }
  }

  return null;
}

function subregionAsCity(subregion: string): string | null {
  const trimmed = subregion.trim();
  if (!trimmed || looksLikeStreet(trimmed)) return null;
  return trimmed.replace(/\s+county$/i, "").trim() || trimmed;
}

/** Town or city for list display — never a street address. */
export function cityFromGeocode(place: LocationGeocodedAddress): string {
  const rawCity = place.city?.trim();
  if (rawCity && !looksLikeStreet(rawCity)) {
    return rawCity;
  }

  if (place.formattedAddress) {
    const fromFormatted = parseCityFromAddressString(place.formattedAddress);
    if (fromFormatted) return fromFormatted;
  }

  const district = place.district?.trim();
  if (district && !looksLikeStreet(district)) {
    return district;
  }

  const fromSubregion = place.subregion ? subregionAsCity(place.subregion) : null;
  if (fromSubregion) return fromSubregion;

  return "";
}

/** Full street-level address for detail views. */
export function addressFromGeocode(place: LocationGeocodedAddress): string {
  if (place.formattedAddress?.trim()) {
    return place.formattedAddress.trim();
  }

  const street = [place.streetNumber, place.street].filter(Boolean).join(" ");
  const parts = [street, place.city, place.region, place.postalCode, place.country].filter(
    Boolean,
  );
  return parts.join(", ");
}

function placeLabel(place: LocationGeocodedAddress, city: string): string {
  const name = place.name?.trim();
  if (name && !looksLikeStreet(name) && name !== city) {
    return name;
  }
  return city || name || "";
}

const ADMIN_REGION_ABBREV: Record<string, string> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "nova scotia": "NS",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  "northwest territories": "NT",
  nunavut: "NU",
  yukon: "YT",
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

/** Short province/state code when possible (e.g. Alberta → AB). */
export function abbreviateAdministrativeRegion(region: string): string {
  const trimmed = region.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 3) return trimmed;
  return ADMIN_REGION_ABBREV[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Human label for Explore regional headers — e.g. "Parkland County, AB".
 * Prefers county-style subregions in rural areas, otherwise city + province/state.
 */
export function exploreRegionLabelFromGeocode(
  place: LocationGeocodedAddress,
): string {
  const regionShort = abbreviateAdministrativeRegion(place.region?.trim() ?? "");
  const subregion = place.subregion?.trim() ?? "";

  if (subregion && /county|parish|borough|municipality/i.test(subregion)) {
    return regionShort ? `${subregion}, ${regionShort}` : subregion;
  }

  const city = cityFromGeocode(place);
  if (city && regionShort) return `${city}, ${regionShort}`;
  if (city) return city;

  if (subregion && regionShort) return `${subregion}, ${regionShort}`;
  if (subregion) return subregion;

  return regionShort;
}

export function applyGeocodeFields(
  place: LocationGeocodedAddress,
): { city: string; address: string; label: string } {
  const address = addressFromGeocode(place);
  let city = cityFromGeocode(place);

  if (!city && address) {
    city = parseCityFromAddressString(address) ?? "";
  }

  if (!city && place.subregion) {
    city = subregionAsCity(place.subregion) ?? "";
  }

  const label = placeLabel(place, city);
  return { city, address, label };
}

export function isLikelyStreetAddress(text: string): boolean {
  if (!text.includes(",")) {
    return looksLikeStreet(text);
  }
  return looksLikeStreet(text.split(",")[0]?.trim() ?? text);
}
