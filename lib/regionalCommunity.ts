import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { normalizeScientificName } from "@/lib/taxonomy";
import {
  setCommunityBoostResolver,
  type RegionalContext,
} from "@/lib/regionalFrequency";

const CACHE_PREFIX = "regional_community:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  counts: Record<string, number>;
}

const memoryCache = new Map<string, CacheEntry>();
const pendingCounts = new Map<string, Record<string, number>>();

function cacheKey(ctx: RegionalContext): string {
  return `${ctx.bundleRegion}:${ctx.cellId}:${ctx.month}`;
}

async function readCache(key: string): Promise<CacheEntry | null> {
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.fetchedAt < CACHE_TTL_MS) {
    return mem;
  }

  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(key: string, entry: CacheEntry): Promise<void> {
  memoryCache.set(key, entry);
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // cache is best-effort
  }
}

async function fetchCellCounts(ctx: RegionalContext): Promise<Record<string, number>> {
  const key = cacheKey(ctx);
  const cached = await readCache(key);
  if (cached) return cached.counts;

  const { data, error } = await supabase
    .from("regional_sighting_counts")
    .select("scientific_name, sighting_count")
    .eq("cell_id", ctx.cellId)
    .eq("month", ctx.month);

  if (error) {
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const scientific = normalizeScientificName(row.scientific_name);
    if (!scientific) continue;
    counts[scientific] = (counts[scientific] ?? 0) + (row.sighting_count ?? 0);
  }

  const entry = { fetchedAt: Date.now(), counts };
  await writeCache(key, entry);
  return counts;
}

function communityBoostFromCounts(
  counts: Record<string, number>,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;
  const count = counts[key] ?? 0;
  if (count <= 0) return 0;
  return Math.log1p(count);
}

/** Wire community counts into regional frequency scoring. Call once at app start. */
export function initRegionalCommunity(): void {
  setCommunityBoostResolver((ctx, scientificName) => {
    const key = cacheKey(ctx);
    const counts = pendingCounts.get(key);
    if (!counts) return 0;
    return communityBoostFromCounts(counts, scientificName);
  });
}

/** Prefetch community counts for a live session or sighting form. */
export async function prefetchRegionalCommunity(ctx: RegionalContext): Promise<void> {
  const key = cacheKey(ctx);
  if (pendingCounts.has(key)) return;
  const counts = await fetchCellCounts(ctx);
  pendingCounts.set(key, counts);
}

export function clearRegionalCommunityCache(): void {
  memoryCache.clear();
  pendingCounts.clear();
}
