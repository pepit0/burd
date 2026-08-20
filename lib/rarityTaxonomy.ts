import { resolveCatalogSpecies } from "@/lib/speciesCatalog";
import { normalizeScientificName } from "@/lib/taxonomy";

/**
 * Rarity-only scientific name aliases (checklist / GBIF splits vs model catalog).
 * Photo/sound ID does not use this map.
 */
export const RARITY_SCIENTIFIC_ALIASES: Record<string, string> = {
  "larus argentatus": "larus smithsonianus",
  "larus cachinnans": "larus michahellis",
};

/** Gull genera eligible for same-region genus abundance fallback (rarity display only). */
export const RARITY_GENUS_FALLBACK_GENERA = new Set([
  "larus",
  "chroicocephalus",
  "leucophaeus",
  "hydrocoloeus",
  "ichthyaetus",
]);

export function resolveRarityScientificKey(
  species: string,
  scientificName: string | null,
): string {
  const catalog = resolveCatalogSpecies(species, scientificName);
  let key =
    normalizeScientificName(catalog?.scientific_name ?? scientificName) ||
    normalizeScientificName(species);
  if (!key) return "";
  return RARITY_SCIENTIFIC_ALIASES[key] ?? key;
}

/** Alternate checklist / GBIF keys to consult for rarity frequency lookup. */
export function rarityLookupKeys(key: string): string[] {
  if (!key) return [];
  const keys = new Set<string>([key]);
  const alias = RARITY_SCIENTIFIC_ALIASES[key];
  if (alias) keys.add(alias);
  for (const [from, to] of Object.entries(RARITY_SCIENTIFIC_ALIASES)) {
    if (to === key) keys.add(from);
  }
  return [...keys];
}
