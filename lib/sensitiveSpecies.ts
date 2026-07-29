import sensitiveSpeciesData from "@/data/sensitive-species.json";

export interface SensitiveSpeciesEntry {
  scientific_name: string;
  common_name: string;
  min_fuzz_km: number;
}

const byScientific = new Map<string, SensitiveSpeciesEntry>();
const byCommon = new Map<string, SensitiveSpeciesEntry>();

for (const entry of sensitiveSpeciesData.species as SensitiveSpeciesEntry[]) {
  byScientific.set(entry.scientific_name.toLowerCase(), entry);
  byCommon.set(entry.common_name.toLowerCase(), entry);
}

export function getSensitiveSpeciesEntry(
  scientificName: string | null | undefined,
  commonName: string | null | undefined,
): SensitiveSpeciesEntry | null {
  const sci = scientificName?.trim().toLowerCase();
  if (sci && byScientific.has(sci)) {
    return byScientific.get(sci)!;
  }
  const common = commonName?.trim().toLowerCase();
  if (common && byCommon.has(common)) {
    return byCommon.get(common)!;
  }
  return null;
}

export function isSensitiveSpecies(
  scientificName: string | null | undefined,
  commonName: string | null | undefined,
): boolean {
  return getSensitiveSpeciesEntry(scientificName, commonName) != null;
}

export function sensitiveSpeciesMinFuzzKm(
  scientificName: string | null | undefined,
  commonName: string | null | undefined,
): number | null {
  return getSensitiveSpeciesEntry(scientificName, commonName)?.min_fuzz_km ?? null;
}

export const SENSITIVE_SPECIES_COUNT = sensitiveSpeciesData.species.length;
