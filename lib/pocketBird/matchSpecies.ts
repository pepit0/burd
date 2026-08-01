import pocketBirdAssets from "@/data/pocket-bird/assets.json";
import type { FieldGuideEntry } from "@/lib/fieldGuide";
import { colonySeed } from "@/lib/colonyLoggedSpecies";

export const POCKET_BIRD_GRID = pocketBirdAssets.spriteWidth;

export type PocketBirdRarity = "common" | "uncommon" | "secret";

export interface PocketBirdSpecies {
  id: string;
  name: string;
  description: string;
  latinName: string;
  url: string;
  spriteIndex: number;
  highlightColor: string;
  tags?: string[];
  rarity: PocketBirdRarity;
}

type Assets = typeof pocketBirdAssets;
const assets = pocketBirdAssets as Assets;

const SECRET_SPECIES = new Set(["invisible", "pride", "trans", "pidgey"]);

const latinIndex = new Map<string, string>();
for (const [id, species] of Object.entries(assets.species)) {
  latinIndex.set(normalizeScientific(species.latinName), id);
}

function normalizeScientific(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, " ");
}

function binomial(name: string): string | null {
  const parts = normalizeScientific(name).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]} ${parts[1]}`;
}

function toCatalogEntry(id: string): PocketBirdSpecies {
  const raw = assets.species[id as keyof typeof assets.species];
  return {
    id,
    name: raw.name,
    description: raw.description,
    latinName: raw.latinName,
    url: raw.url,
    spriteIndex: raw.spriteIndex,
    highlightColor: raw.highlightColor,
    tags: "tags" in raw ? raw.tags : undefined,
    rarity:
      ("rarity" in raw && raw.rarity
        ? raw.rarity
        : "common") as PocketBirdRarity,
  };
}

export function listPocketBirdSpecies(options?: {
  includeSecret?: boolean;
}): PocketBirdSpecies[] {
  const includeSecret = options?.includeSecret ?? false;
  return Object.keys(assets.species)
    .filter((id) => includeSecret || !SECRET_SPECIES.has(id))
    .map(toCatalogEntry)
    .sort((a, b) => {
      const rarityOrder = { common: 0, uncommon: 1, secret: 2 };
      const diff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
}

export function getPocketBirdSpeciesById(id: string): PocketBirdSpecies {
  if (assets.species[id as keyof typeof assets.species]) {
    return toCatalogEntry(id);
  }
  return toCatalogEntry("bluebird");
}

export function isPocketBirdSpeciesId(id: string): boolean {
  return id in assets.species;
}

/** Map a logged Burd species to the closest Pocket Bird sprite id. */
export function matchPocketBirdSpecies(entry: FieldGuideEntry): string {
  const normalized = normalizeScientific(entry.scientific_name);
  const direct = latinIndex.get(normalized);
  if (direct && !SECRET_SPECIES.has(direct)) return direct;

  const binomialMatch = binomial(entry.scientific_name);
  if (binomialMatch) {
    const byBinomial = latinIndex.get(binomialMatch);
    if (byBinomial && !SECRET_SPECIES.has(byBinomial)) return byBinomial;
  }

  const common = entry.species.trim().toLowerCase();
  for (const [id, species] of Object.entries(assets.species)) {
    if (SECRET_SPECIES.has(id)) continue;
    if (species.name.trim().toLowerCase() === common) return id;
  }

  const pool = listPocketBirdSpecies().map((s) => s.id);
  const pick =
    pool[Math.floor(colonySeed(entry.id || entry.scientific_name, 99) * pool.length)];
  return pick ?? "bluebird";
}

export function getPocketBirdSpecies(id: string): Pick<
  PocketBirdSpecies,
  "name" | "latinName" | "spriteIndex" | "tags"
> {
  const species = assets.species[id as keyof typeof assets.species];
  if (!species) return assets.species.bluebird;
  return species;
}

export function getPocketBirdPalette(id: string): Record<string, string> {
  return assets.speciesPalettes[id as keyof typeof assets.speciesPalettes] ?? {};
}

export function getPocketBirdSpriteSheet(): string[][] {
  return assets.birbPixels;
}

export function getPocketBirdAttribution(): { source: string; license: string } {
  return { source: assets.source, license: assets.license };
}

// Back-compat alias
export { getPocketBirdSpeciesById as getPocketBirdSpeciesDetail };
