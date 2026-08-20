import { lookupBaselineRarity, maxRarity, minRarity } from "@/lib/speciesBaselines";
import {
  cellHasGbifData,
  collectRaritySpeciesCandidates,
  lookupRarityDisplayFrequency,
  MIN_EXPECTED_FREQ,
  type RegionalContext,
} from "@/lib/regionalFrequency";
import { hasChecklistData } from "@/lib/speciesChecklist";
import { isInCatalog } from "@/lib/taxonomy";
import {
  RARITY_GENUS_FALLBACK_GENERA,
  rarityLookupKeys,
  resolveRarityScientificKey,
} from "@/lib/rarityTaxonomy";
import type { Rarity } from "@/types";

/** Top 40% of expected species in the regional pool → common. */
export const RARITY_COMMON_PERCENTILE = 0.4;
/** Next 40% → uncommon; bottom 20% → rare. */
export const RARITY_UNCOMMON_PERCENTILE = 0.8;
/** Minimum expected species in pool before percentile ranking applies. */
export const RARITY_MIN_POOL_SIZE = 8;
/** Expected species above this frequency are never labeled rare. */
export const RARITY_ABSOLUTE_UNCOMMON_FLOOR = 0.012;
/** Absolute frequency tiers when percentile pool is too small. */
export const RARITY_ABSOLUTE_COMMON = 0.065;
export const RARITY_ABSOLUTE_UNCOMMON = 0.028;

/** Genus fallback: fraction of the richest same-genus neighbor in the regional pool. */
const GENUS_FALLBACK_RATIO = 0.6;
const GENUS_FALLBACK_MIN_REGIONAL = 0.035;

const frequencyPoolCache = new Map<string, Map<string, number>>();

function poolCacheKey(ctx: RegionalContext): string {
  return `${ctx.bundleRegion}:${ctx.cellId}:${ctx.month}`;
}

export function hasRegionalRarityConfidence(ctx: RegionalContext): boolean {
  return hasChecklistData(ctx.lat, ctx.lng) || cellHasGbifData(ctx);
}

function rawRarityFrequency(ctx: RegionalContext, key: string): number {
  let best = 0;
  for (const lookupKey of rarityLookupKeys(key)) {
    best = Math.max(best, lookupRarityDisplayFrequency(ctx, lookupKey));
  }
  return best;
}

function genusFallbackFrequency(
  ctx: RegionalContext,
  key: string,
  pool: Map<string, number>,
): number {
  const genus = key.split(" ")[0];
  if (!RARITY_GENUS_FALLBACK_GENERA.has(genus) || !isInCatalog(key)) {
    return 0;
  }

  let genusMax = 0;
  for (const [candidate, frequency] of pool.entries()) {
    if (!candidate.startsWith(`${genus} `)) continue;
    if (candidate === key) continue;
    genusMax = Math.max(genusMax, frequency);
  }

  if (genusMax < GENUS_FALLBACK_MIN_REGIONAL) return 0;
  return genusMax * GENUS_FALLBACK_RATIO;
}

function lookupRaritySpeciesFrequency(
  ctx: RegionalContext,
  key: string,
  pool?: Map<string, number>,
): number {
  let frequency = rawRarityFrequency(ctx, key);
  if (frequency > 0 || !pool) return frequency;

  return genusFallbackFrequency(ctx, key, pool);
}

function getFrequencyPool(ctx: RegionalContext): Map<string, number> {
  const cacheKey = poolCacheKey(ctx);
  const cached = frequencyPoolCache.get(cacheKey);
  if (cached) return cached;

  const candidates = collectRaritySpeciesCandidates(
    ctx.lat,
    ctx.lng,
    ctx.date,
  );
  const pool = new Map<string, number>();

  for (const key of candidates) {
    pool.set(key, rawRarityFrequency(ctx, key));
  }

  for (const key of candidates) {
    pool.set(key, lookupRaritySpeciesFrequency(ctx, key, pool));
  }

  frequencyPoolCache.set(cacheKey, pool);
  return pool;
}

function absoluteRarityFromFrequency(
  frequency: number,
  expected: boolean,
): Rarity {
  if (!expected || frequency <= 0) return "rare";
  if (frequency >= RARITY_ABSOLUTE_COMMON) return "common";
  if (frequency >= RARITY_ABSOLUTE_UNCOMMON) return "uncommon";
  if (frequency >= RARITY_ABSOLUTE_UNCOMMON_FLOOR) return "uncommon";
  return "rare";
}

function percentileRarityFromPool(
  targetKey: string,
  pool: Map<string, number>,
): Rarity {
  const targetFreq = pool.get(targetKey) ?? 0;
  const expected = targetFreq >= MIN_EXPECTED_FREQ;

  if (!expected) return "rare";

  const ranked = [...pool.entries()]
    .filter(([, frequency]) => frequency >= MIN_EXPECTED_FREQ)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (ranked.length < RARITY_MIN_POOL_SIZE) {
    return absoluteRarityFromFrequency(targetFreq, expected);
  }

  const rank = ranked.findIndex(([key]) => key === targetKey);
  if (rank < 0) return "rare";

  const percentile = rank / ranked.length;
  let percentileRarity: Rarity;
  if (percentile < RARITY_COMMON_PERCENTILE) percentileRarity = "common";
  else if (percentile < RARITY_UNCOMMON_PERCENTILE) percentileRarity = "uncommon";
  else percentileRarity = "rare";

  const absoluteRarity = absoluteRarityFromFrequency(targetFreq, expected);
  return minRarity(percentileRarity, absoluteRarity);
}

function resolvePoolKey(
  pool: Map<string, number>,
  key: string,
): string {
  if (pool.has(key)) return key;
  for (const lookupKey of rarityLookupKeys(key)) {
    if (pool.has(lookupKey)) return lookupKey;
  }
  return key;
}

export function scoreRegionalRarity(
  ctx: RegionalContext,
  species: string,
  scientificName: string | null,
): Rarity {
  const key = resolveRarityScientificKey(species, scientificName);
  const baseline = lookupBaselineRarity(species, scientificName);

  if (!key) {
    return baseline ?? "common";
  }

  if (!hasRegionalRarityConfidence(ctx)) {
    return baseline ?? "common";
  }

  const pool = getFrequencyPool(ctx);
  const poolKey = resolvePoolKey(pool, key);

  if (!pool.has(poolKey)) {
    pool.set(poolKey, lookupRaritySpeciesFrequency(ctx, poolKey, pool));
  }

  const regional = percentileRarityFromPool(poolKey, pool);
  if (baseline) {
    return maxRarity(regional, baseline);
  }
  return regional;
}

/** @internal Test helper — clears cached percentile pools. */
export function clearRarityPoolCacheForTests(): void {
  frequencyPoolCache.clear();
}
