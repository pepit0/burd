import { SPECIES_IMAGE_URLS } from "@/lib/speciesImageUrls";

export type SpeciesImageSize = "medium" | "large" | "original";

const runtimeCache = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string>>();

const MAX_CONCURRENT_FETCHES = 1;
const FETCH_GAP_MS = 120;
let activeFetches = 0;
const fetchWaitQueue: (() => void)[] = [];

function acquireFetchSlot(): Promise<void> {
  if (activeFetches < MAX_CONCURRENT_FETCHES) {
    activeFetches += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    fetchWaitQueue.push(() => {
      activeFetches += 1;
      resolve();
    });
  });
}

function releaseFetchSlot(): void {
  activeFetches -= 1;
  setTimeout(() => {
    const next = fetchWaitQueue.shift();
    if (next) next();
  }, FETCH_GAP_MS);
}

const PLACEHOLDER =
  "https://static.inaturalist.org/photos/25544008/medium.jpeg";

function sizedUrl(url: string, size: SpeciesImageSize): string {
  if (size === "medium") return url;
  return url.replace(/\/(medium|large|original)\.(jpe?g|png)/i, `/${size}.$2`);
}

/** Sync URL from the baked catalog map (instant grid render). */
export function speciesImageUrl(
  catalogId: string,
  size: SpeciesImageSize = "medium",
): string | null {
  const url = SPECIES_IMAGE_URLS[catalogId];
  if (!url) return null;
  return sizedUrl(url, size);
}

/** Resolve a photo for any catalog species — baked first, then iNaturalist API. */
export async function resolveSpeciesImageUrl(
  catalogId: string,
  scientificName: string,
  size: SpeciesImageSize = "medium",
): Promise<string> {
  const baked = speciesImageUrl(catalogId, size);
  if (baked) return baked;

  const cacheKey = `${catalogId}:${size}`;
  const cached = runtimeCache.get(cacheKey);
  if (cached) return cached;

  const pending = pendingFetches.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    await acquireFetchSlot();
    try {
      const fetched = await fetchInatDefaultPhoto(scientificName);
      const url = fetched ? sizedUrl(fetched, size) : PLACEHOLDER;
      runtimeCache.set(cacheKey, url);
      return url;
    } finally {
      releaseFetchSlot();
      pendingFetches.delete(cacheKey);
    }
  })();

  pendingFetches.set(cacheKey, promise);
  return promise;
}

async function fetchInatDefaultPhoto(
  scientificName: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: scientificName,
      rank: "species",
      per_page: "1",
    });
    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa?${params.toString()}`,
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: { default_photo?: { url?: string } }[];
    };
    const photoUrl = data.results?.[0]?.default_photo?.url;
    if (!photoUrl) return null;

    return photoUrl.replace("square", "medium");
  } catch {
    return null;
  }
}

/** @deprecated Use speciesImageUrl */
export function catalogImageUrl(
  entry: { id: string },
  size: SpeciesImageSize = "medium",
): string {
  return speciesImageUrl(entry.id, size) ?? PLACEHOLDER;
}
