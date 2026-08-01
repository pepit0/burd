import speciesCalls from "@/data/species-calls.json";

export interface SpeciesCallEntry {
  audioUrl: string;
  recordist: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string | null;
  callType: string | null;
  xcId: string | null;
}

const CALLS_BY_ID = speciesCalls as Record<string, SpeciesCallEntry>;

export function getSpeciesCall(catalogId: string): SpeciesCallEntry | null {
  const trimmed = catalogId.trim();
  if (!trimmed) return null;
  return CALLS_BY_ID[trimmed] ?? null;
}

export function hasSpeciesCall(catalogId: string): boolean {
  return getSpeciesCall(catalogId) != null;
}

export function speciesCallAttribution(call: SpeciesCallEntry): string {
  const parts = [`Recording: ${call.recordist}`, call.license];
  if (call.xcId) parts.push(`XC${call.xcId}`);
  return parts.join(" · ");
}
