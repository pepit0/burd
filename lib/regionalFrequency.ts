import manifestNa from "@/data/regional-priors/manifest.json";
import manifestGlobal from "@/data/regional-priors/manifest-global.json";
import naPriors from "@/data/regional-priors/na-priors.json";
import globalPriors from "@/data/regional-priors/global-priors.json";
import {
  bundleRegionForCoords,
  cellIdFromLatLng,
  gridDegForRegion,
  neighborCellIds,
} from "@/lib/cellId";
import {
  exploreChecklistPrior,
  neighborDistanceWeight,
} from "@/lib/exploreChecklist";
import {
  checklistPrior,
  checklistSpeciesForCoords,
  hasChecklistData,
  isOnRegionalChecklist,
} from "@/lib/speciesChecklist";
import {
  isInCatalog,
  normalizeScientificName,
  scientificKeyForPrediction,
} from "@/lib/taxonomy";
import { isInSoundTaxonomy, scientificKeyForSoundPrediction } from "@/lib/soundTaxonomy";
import type { Prediction, Rarity } from "@/types";

export const MIN_EXPECTED_FREQ = 0.001;
export const VAGRANT_CONFIDENCE = 0.55;
/** Non-catalog taxa need higher confidence to surface as vagrants. */
export const NON_CATALOG_VAGRANT_CONFIDENCE = 0.65;
export const GEO_ALPHA = 0.4;
export const GEO_EPSILON = 0.02;
export const COMMUNITY_WEIGHT = 0.15;

export interface RegionalContext {
  lat: number;
  lng: number;
  date: Date;
  cellId: string;
  month: number;
  bundleRegion: "na" | "global";
}

export interface SpeciesRegionalScore {
  scientificName: string;
  frequency: number;
  expected: boolean;
  rarity: Rarity;
}

type PriorEntry = { f: number; c: number };
type CellMonthMap = Record<string, PriorEntry>;
type MonthMap = Record<string, CellMonthMap>;
type BundleCells = Record<string, MonthMap>;

interface PriorBundle {
  cells: BundleCells;
}

const naBundle = naPriors as PriorBundle;
const globalBundle = globalPriors as PriorBundle;

const cellCache = new Map<string, CellMonthMap>();
const gbifFreqCache = new Map<string, number>();
const gbifStrictFreqCache = new Map<string, number>();

function cacheKey(region: "na" | "global", cellId: string, month: number): string {
  return `${region}:${cellId}:${month}`;
}

function maxSpeciesFreqInCell(
  bundle: PriorBundle,
  cellId: string,
  speciesKey: string,
): number {
  const cell = bundle.cells[cellId];
  if (!cell) return 0;

  let max = 0;
  for (const monthData of Object.values(cell)) {
    const freq = monthData[speciesKey]?.f ?? 0;
    if (freq > max) max = freq;
  }
  return max;
}

function bundleForRegion(region: "na" | "global"): PriorBundle {
  return region === "na" ? naBundle : globalBundle;
}

function getCellMonthPriors(
  region: "na" | "global",
  cellId: string,
  month: number,
): CellMonthMap {
  const key = cacheKey(region, cellId, month);
  const cached = cellCache.get(key);
  if (cached) return cached;

  const bundle = bundleForRegion(region);
  const monthMap = bundle.cells[cellId]?.[String(month)] ?? {};
  cellCache.set(key, monthMap);
  return monthMap;
}

export function getRegionalContext(
  lat: number,
  lng: number,
  date: Date = new Date(),
): RegionalContext {
  const month = date.getMonth() + 1;
  const bundleRegion = bundleRegionForCoords(lat, lng);
  return {
    lat,
    lng,
    date,
    cellId: cellIdFromLatLng(lat, lng),
    month,
    bundleRegion,
  };
}

function communityBoost(_ctx: RegionalContext, _scientificName: string): number {
  // Filled by regionalCommunity.ts via setCommunityBoostResolver
  return communityBoostResolver?.(_ctx, _scientificName) ?? 0;
}

let communityBoostResolver:
  | ((ctx: RegionalContext, scientificName: string) => number)
  | null = null;

export function setCommunityBoostResolver(
  resolver: (ctx: RegionalContext, scientificName: string) => number,
): void {
  communityBoostResolver = resolver;
}

function gbifFrequency(
  ctx: RegionalContext,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;

  const cacheId = `${ctx.bundleRegion}:${ctx.cellId}:${ctx.month}:${key}`;
  const cached = gbifFreqCache.get(cacheId);
  if (cached !== undefined) return cached;

  const priors = getCellMonthPriors(ctx.bundleRegion, ctx.cellId, ctx.month);
  let freq = priors[key]?.f ?? 0;

  if (freq === 0) {
    const bundle = bundleForRegion(ctx.bundleRegion);
    freq = maxSpeciesFreqInCell(bundle, ctx.cellId, key);
  }

  if (freq === 0) {
    const bundle = bundleForRegion(ctx.bundleRegion);
    const gridDeg = gridDegForRegion(ctx.bundleRegion);
    for (const neighborId of neighborCellIds(ctx.cellId, gridDeg)) {
      const neighborMonth = getCellMonthPriors(
        ctx.bundleRegion,
        neighborId,
        ctx.month,
      );
      const neighborFreq = neighborMonth[key]?.f ?? 0;
      if (neighborFreq > freq) freq = neighborFreq;
    }
  }

  if (freq === 0) {
    const bundle = bundleForRegion(ctx.bundleRegion);
    const gridDeg = gridDegForRegion(ctx.bundleRegion);
    for (const neighborId of neighborCellIds(ctx.cellId, gridDeg)) {
      const neighborFreq = maxSpeciesFreqInCell(bundle, neighborId, key);
      if (neighborFreq > freq) freq = neighborFreq;
    }
  }

  gbifFreqCache.set(cacheId, freq);
  return freq;
}

/** Month-matched GBIF only — no cross-month bleed (for Explore charts and lists). */
function gbifFrequencyStrict(
  ctx: RegionalContext,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;

  const cacheId = `strict:${ctx.bundleRegion}:${ctx.cellId}:${ctx.month}:${key}`;
  const cached = gbifStrictFreqCache.get(cacheId);
  if (cached !== undefined) return cached;

  const priors = getCellMonthPriors(ctx.bundleRegion, ctx.cellId, ctx.month);
  let freq = priors[key]?.f ?? 0;

  if (freq === 0) {
    const gridDeg = gridDegForRegion(ctx.bundleRegion);
    for (const neighborId of neighborCellIds(ctx.cellId, gridDeg)) {
      const neighborMonth = getCellMonthPriors(
        ctx.bundleRegion,
        neighborId,
        ctx.month,
      );
      const neighborFreq = neighborMonth[key]?.f ?? 0;
      if (neighborFreq > 0) {
        const weighted =
          neighborFreq *
          neighborDistanceWeight(
            ctx.lat,
            ctx.lng,
            neighborId,
            ctx.bundleRegion,
          );
        if (weighted > freq) freq = weighted;
      }
    }
  }

  gbifStrictFreqCache.set(cacheId, freq);
  return freq;
}

function geoPrior(ctx: RegionalContext, scientificName: string): number {
  const gbif = gbifFrequency(ctx, scientificName);
  const checklist = checklistPrior(ctx, scientificName);
  const base = Math.max(gbif, checklist);
  const boost = communityBoost(ctx, scientificName);
  return base + boost * COMMUNITY_WEIGHT;
}

function geoPriorStrict(ctx: RegionalContext, scientificName: string): number {
  const gbif = gbifFrequencyStrict(ctx, scientificName);
  const checklist = exploreChecklistPrior(
    { lat: ctx.lat, lng: ctx.lng, month: ctx.month },
    scientificName,
  );
  const base = Math.max(gbif, checklist);
  const boost = communityBoost(ctx, scientificName);
  return base + boost * COMMUNITY_WEIGHT;
}

/** True when GBIF bundle has any species data for this cell (or neighbors). */
export function cellHasGbifData(ctx: RegionalContext): boolean {
  const bundle = bundleForRegion(ctx.bundleRegion);
  const gridDeg = gridDegForRegion(ctx.bundleRegion);

  const cell = bundle.cells[ctx.cellId];
  if (cell && Object.keys(cell).length > 0) return true;

  for (const neighborId of neighborCellIds(ctx.cellId, gridDeg)) {
    const neighbor = bundle.cells[neighborId];
    if (neighbor && Object.keys(neighbor).length > 0) return true;
  }

  return false;
}

export function isSpeciesExpected(
  ctx: RegionalContext,
  scientificName: string,
): boolean {
  return geoPrior(ctx, scientificName) >= MIN_EXPECTED_FREQ;
}

function rarityFromFrequency(frequency: number, expected: boolean): Rarity {
  if (!expected || frequency <= 0) return "rare";
  if (frequency >= 0.08) return "common";
  if (frequency >= 0.02) return "uncommon";
  return "rare";
}

export function lookupSpeciesScore(
  ctx: RegionalContext | null,
  scientificName: string,
): SpeciesRegionalScore {
  const key = normalizeScientificName(scientificName);
  if (!ctx || !key) {
    return {
      scientificName: key || scientificName,
      frequency: 0,
      expected: false,
      rarity: "common",
    };
  }

  const frequency = geoPrior(ctx, key);
  const expected = frequency >= MIN_EXPECTED_FREQ;
  return {
    scientificName: key,
    frequency,
    expected,
    rarity: rarityFromFrequency(frequency, expected),
  };
}

/** Seasonal abundance score — month-matched GBIF, no cross-month bleed. */
export function lookupSpeciesScoreStrict(
  ctx: RegionalContext | null,
  scientificName: string,
): SpeciesRegionalScore {
  const key = normalizeScientificName(scientificName);
  if (!ctx || !key) {
    return {
      scientificName: key || scientificName,
      frequency: 0,
      expected: false,
      rarity: "common",
    };
  }

  const frequency = geoPriorStrict(ctx, key);
  const expected = frequency >= MIN_EXPECTED_FREQ;
  return {
    scientificName: key,
    frequency,
    expected,
    rarity: rarityFromFrequency(frequency, expected),
  };
}

export function inferRarityFromFrequency(
  ctx: RegionalContext | null,
  species: string,
  scientificName: string | null,
): Rarity | null {
  if (!ctx) return null;
  const key =
    normalizeScientificName(scientificName) ||
    normalizeScientificName(species);
  if (!key) return null;
  return lookupSpeciesScore(ctx, key).rarity;
}

export function scorePrediction(
  ctx: RegionalContext | null,
  prediction: Prediction,
): number {
  if (!ctx) return prediction.confidence;
  const key = scientificKeyForSoundPrediction(prediction);
  const prior = geoPrior(ctx, key);
  return prediction.confidence * Math.pow(GEO_EPSILON + prior, GEO_ALPHA);
}

export function shouldShowPrediction(
  ctx: RegionalContext | null,
  prediction: Prediction,
): boolean {
  const key = scientificKeyForPrediction(prediction);
  const inCatalog = isInCatalog(key);

  if (!ctx) {
    return inCatalog && prediction.confidence >= VAGRANT_CONFIDENCE;
  }

  const prior = geoPrior(ctx, key);
  if (prior >= MIN_EXPECTED_FREQ) return true;

  const vagrantThreshold = inCatalog
    ? VAGRANT_CONFIDENCE
    : NON_CATALOG_VAGRANT_CONFIDENCE;
  return prediction.confidence >= vagrantThreshold;
}

export const LIVE_SOUND_CATALOG_CONFIDENCE = 0.22;
export const AUDIO_VAGRANT_CONFIDENCE = 0.35;
/** Off-checklist + zero geo prior — blocks spurious exotics like Cyanochen in Edmonton. */
export const AUDIO_ZERO_PRIOR_VAGRANT_CONFIDENCE = 0.55;
export const AUDIO_DETECTION_MIN_CONFIDENCE = 0.05;
export const AUDIO_ACOUSTIC_NATIVE_TOP_K = 5;
export const AUDIO_JAY_MIMIC_LOGIT_MARGIN = 1.0;
export const AUDIO_MIMIC_CONFUSER_PRUNE_MAX_CONFIDENCE = 0.12;
export const BLUE_JAY_KEY = "cyanocitta cristata";

const HAWK_GENERA = new Set([
  "accipiter",
  "aquila",
  "buteo",
  "circus",
  "geranoaetus",
  "haliaeetus",
  "melierax",
  "milvus",
  "parabuteo",
]);

const OWL_GENERA = new Set([
  "aegolius",
  "asio",
  "athene",
  "bubo",
  "megascops",
  "otus",
  "strix",
  "surnia",
  "tyto",
]);

const FALCON_GENERA = new Set(["falco", "micrastur", "herpetotheres"]);

const MIMIC_CONFUSER_GENERA = new Set([
  ...HAWK_GENERA,
  ...OWL_GENERA,
  ...FALCON_GENERA,
  "corvus",
]);

export interface NativeLogitInput {
  species_code: string;
  logit: number;
}

export function nativeAcousticTopKeys(
  ctx: RegionalContext,
  nativeLogits: NativeLogitInput[],
  topK: number = AUDIO_ACOUSTIC_NATIVE_TOP_K,
): Set<string> {
  const valid = new Set(
    checklistSpeciesForCoords(ctx.lat, ctx.lng, ctx.month).map((code) =>
      code.toLowerCase(),
    ),
  );
  return new Set(
    nativeLogits
      .filter((entry) =>
        valid.has(normalizeScientificName(entry.species_code)),
      )
      .sort((a, b) => b.logit - a.logit)
      .slice(0, Math.max(1, topK))
      .map((entry) => normalizeScientificName(entry.species_code)),
  );
}

function genusOf(scientificName: string): string | null {
  const parts = scientificName.trim().toLowerCase().split(/\s+/);
  return parts[0] ?? null;
}

function isMimicConfuserGenus(genus: string | null): boolean {
  return genus != null && MIMIC_CONFUSER_GENERA.has(genus);
}

export function checklistNativeLeader(
  ctx: RegionalContext,
  nativeLogits: NativeLogitInput[] | undefined,
): { key: string; logit: number } | null {
  if (!nativeLogits?.length) return null;
  const valid = new Set(
    checklistSpeciesForCoords(ctx.lat, ctx.lng, ctx.month).map((code) =>
      code.toLowerCase(),
    ),
  );
  const logitMap = new Map(
    nativeLogits.map((entry) => [
      normalizeScientificName(entry.species_code),
      entry.logit,
    ]),
  );
  let best: { key: string; logit: number } | null = null;
  for (const code of valid) {
    const logit = logitMap.get(code);
    if (logit == null) continue;
    if (!best || logit > best.logit) {
      best = { key: code, logit };
    }
  }
  return best;
}

function logitForKey(
  key: string,
  nativeLogits: NativeLogitInput[] | undefined,
): number {
  if (!nativeLogits?.length) return Number.NEGATIVE_INFINITY;
  const logitMap = new Map(
    nativeLogits.map((entry) => [
      normalizeScientificName(entry.species_code),
      entry.logit,
    ]),
  );
  return logitMap.get(key) ?? Number.NEGATIVE_INFINITY;
}

function mimicConfuserSuppressedByJay(
  ctx: RegionalContext,
  prediction: Prediction,
  pool: Prediction[],
  nativeLogits?: NativeLogitInput[],
): boolean {
  const key = scientificKeyForSoundPrediction(prediction);
  const genus = genusOf(key);
  if (!isMimicConfuserGenus(genus)) return false;

  const jayInPool = pool.some(
    (candidate) =>
      scientificKeyForSoundPrediction(candidate) === BLUE_JAY_KEY &&
      candidate.confidence >= AUDIO_DETECTION_MIN_CONFIDENCE,
  );
  if (!jayInPool || !isOnRegionalChecklist(ctx, BLUE_JAY_KEY)) return false;

  const jayLogit = logitForKey(BLUE_JAY_KEY, nativeLogits);
  const confuserLogit = logitForKey(key, nativeLogits);
  if (jayLogit === Number.NEGATIVE_INFINITY) return false;
  if (jayLogit < confuserLogit - AUDIO_JAY_MIMIC_LOGIT_MARGIN) return false;
  return prediction.confidence < AUDIO_MIMIC_CONFUSER_PRUNE_MAX_CONFIDENCE;
}

function checklistCongenerInPool(
  ctx: RegionalContext,
  genus: string,
  pool: Prediction[],
  minConfidence: number,
): boolean {
  for (const candidate of pool) {
    const key = scientificKeyForSoundPrediction(candidate);
    if (genusOf(key) !== genus) continue;
    if (candidate.confidence < minConfidence) continue;
    if (isOnRegionalChecklist(ctx, key) || isSpeciesExpected(ctx, key)) {
      return true;
    }
  }
  return false;
}

/**
 * Merlin-style live sound gate: expected, on checklist, or high-confidence vagrant.
 * Suppresses off-checklist congeners (e.g. Eurasian Blackbird) when a local checklist
 * species in the same genus is present (e.g. American Robin).
 */
export function shouldShowLiveSoundPrediction(
  ctx: RegionalContext | null,
  prediction: Prediction,
  pool: Prediction[] | null = null,
  nativeLogits?: NativeLogitInput[],
): boolean {
  const key = scientificKeyForSoundPrediction(prediction);
  if (!isInSoundTaxonomy(key) && !isInCatalog(key)) return false;

  if (!ctx) {
    return prediction.confidence >= AUDIO_VAGRANT_CONFIDENCE;
  }

  const candidates = pool ?? [prediction];
  if (
    mimicConfuserSuppressedByJay(ctx, prediction, candidates, nativeLogits)
  ) {
    return false;
  }

  if (isSpeciesExpected(ctx, key)) return true;
  if (isOnRegionalChecklist(ctx, key)) return true;

  const genus = genusOf(key);
  if (
    genus &&
    checklistCongenerInPool(
      ctx,
      genus,
      candidates,
      AUDIO_DETECTION_MIN_CONFIDENCE,
    )
  ) {
    return false;
  }

  const prior = geoPrior(ctx, key);
  if (prior < MIN_EXPECTED_FREQ) {
    return false;
  }
  return prediction.confidence >= AUDIO_VAGRANT_CONFIDENCE;
}

export function rankLiveSoundPredictions(
  ctx: RegionalContext | null,
  predictions: Prediction[],
  candidatePool?: Prediction[],
  nativeLogits?: NativeLogitInput[],
): Prediction[] {
  const pool = candidatePool ?? predictions;
  const logitMap = new Map(
    (nativeLogits ?? []).map((entry) => [
      normalizeScientificName(entry.species_code),
      entry.logit,
    ]),
  );

  const logitFor = (prediction: Prediction): number => {
    const key = scientificKeyForSoundPrediction(prediction);
    return logitMap.get(key) ?? Number.NEGATIVE_INFINITY;
  };

  if (!ctx) {
    return [...predictions]
      .filter((p) => {
        const key = scientificKeyForSoundPrediction(p);
        return (
          (isInSoundTaxonomy(key) || isInCatalog(key)) &&
          p.confidence >= AUDIO_DETECTION_MIN_CONFIDENCE
        );
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  const sortWithAcoustic = (a: Prediction, b: Prediction) => {
    const logitDiff = logitFor(b) - logitFor(a);
    if (logitDiff !== 0) return logitDiff;
    const scoreDiff = scorePrediction(ctx, b) - scorePrediction(ctx, a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.confidence - a.confidence;
  };

  const ranked = [...predictions]
    .filter((p) => shouldShowLiveSoundPrediction(ctx, p, pool, nativeLogits))
    .sort(sortWithAcoustic);

  if (ranked.length > 0) return ranked;

  return [...predictions]
    .filter((p) => shouldShowLiveSoundPrediction(ctx, p, pool, nativeLogits))
    .filter((p) => p.confidence >= AUDIO_DETECTION_MIN_CONFIDENCE)
    .sort(sortWithAcoustic);
}

export function rankPredictions(
  ctx: RegionalContext | null,
  predictions: Prediction[],
): Prediction[] {
  if (!ctx) return [...predictions];

  return [...predictions]
    .filter((p) => shouldShowPrediction(ctx, p))
    .sort((a, b) => scorePrediction(ctx, b) - scorePrediction(ctx, a));
}

export interface MonthlyAbundance {
  month: number;
  frequency: number;
  expected: boolean;
}

/** Geo/season abundance for each calendar month at a location. */
export function getSpeciesMonthlyAbundance(
  lat: number,
  lng: number,
  scientificName: string,
  referenceYear = new Date().getFullYear(),
): MonthlyAbundance[] {
  const key = normalizeScientificName(scientificName);
  if (!key) return [];

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const ctx = getRegionalContext(
      lat,
      lng,
      new Date(referenceYear, month - 1, 15),
    );
    const score = lookupSpeciesScoreStrict(ctx, key);
    return {
      month,
      frequency: score.frequency,
      expected: score.expected,
    };
  });
}

/** Species keys from GBIF cell priors and ecozone checklist for a location/month. */
export function collectRegionalSpeciesCandidates(
  lat: number,
  lng: number,
  date: Date = new Date(),
): string[] {
  const ctx = getRegionalContext(lat, lng, date);
  const candidates = new Set<string>();
  const bundle = bundleForRegion(ctx.bundleRegion);
  const gridDeg = gridDegForRegion(ctx.bundleRegion);
  const cellIds = [ctx.cellId, ...neighborCellIds(ctx.cellId, gridDeg)];

  for (const cell of cellIds) {
    const monthMap = bundle.cells[cell]?.[String(ctx.month)] ?? {};
    for (const key of Object.keys(monthMap)) {
      candidates.add(key);
    }
  }

  for (const key of checklistSpeciesForCoords(lat, lng, ctx.month)) {
    candidates.add(key);
  }

  return [...candidates];
}

export function getDataAttribution(): string[] {
  const lines = new Set<string>();
  for (const m of [manifestNa, manifestGlobal]) {
    const manifest = m as { attribution?: string[] };
    for (const line of manifest.attribution ?? []) {
      lines.add(line);
    }
  }
  return [...lines];
}

export function getManifestVersion(): string {
  const na = manifestNa as { built_at?: string; source?: string };
  const global = manifestGlobal as { built_at?: string; source?: string };
  return `na:${na.source ?? "?"}@${na.built_at ?? "?"}; global:${global.source ?? "?"}@${global.built_at ?? "?"}`;
}
