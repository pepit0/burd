import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLONY_BIT_GRID } from "@/lib/colonyBitArt";
import { resolveSpeciesImageUrl, speciesImageUrl } from "@/lib/speciesImages";
import type { BitPixel } from "@/lib/colonyBitArt";
import { photoToBitGrid } from "@/lib/photoToBitGrid";

const memoryCache = new Map<string, BitPixel[]>();
const inflight = new Map<string, Promise<BitPixel[] | null>>();

function cacheKey(catalogId: string, scientificName: string): string {
  return `colony-bit-v2-${COLONY_BIT_GRID}:${catalogId || scientificName}`;
}

async function readDisk(key: string): Promise<BitPixel[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as BitPixel[];
  } catch {
    return null;
  }
}

async function writeDisk(key: string, pixels: BitPixel[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(pixels));
  } catch {
    // ignore quota errors
  }
}

export function previewSpeciesPhotoUri(
  catalogId: string,
  scientificName: string,
): string | null {
  return speciesImageUrl(catalogId, scientificName, "medium");
}

/** Build or load a bit-art pixel grid derived from the species reference photo. */
export async function resolveBitBirdGrid(
  catalogId: string,
  scientificName: string,
): Promise<BitPixel[] | null> {
  const key = cacheKey(catalogId, scientificName);
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const cached = await readDisk(key);
    if (cached?.length) {
      memoryCache.set(key, cached);
      return cached;
    }

    const remote =
      speciesImageUrl(catalogId, scientificName, "large") ??
      (await resolveSpeciesImageUrl(catalogId, scientificName, "large"));
    if (!remote) return null;

    const pixels = await photoToBitGrid(remote);
    if (pixels?.length) {
      memoryCache.set(key, pixels);
      void writeDisk(key, pixels);
    }
    return pixels;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}
