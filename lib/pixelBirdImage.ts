import * as FileSystem from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { resolveSpeciesImageUrl, speciesImageUrl } from "@/lib/speciesImages";

/** Internal pixel grid — displayed upscaled with nearest-neighbor in Colony. */
export const COLONY_PIXEL_SIZE = 56;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

let activeJobs = 0;
const MAX_JOBS = 3;
const waitQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_JOBS) {
    activeJobs += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeJobs += 1;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeJobs -= 1;
  const next = waitQueue.shift();
  if (next) next();
}

function cachePath(key: string): string {
  return `${FileSystem.cacheDirectory ?? ""}colony-pixel-v2-${key}.png`;
}

async function pixelateLocalUri(localUri: string, cacheKey: string): Promise<string> {
  const target = cachePath(cacheKey);
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) return target;

  const resized = await manipulateAsync(
    localUri,
    [{ resize: { width: COLONY_PIXEL_SIZE } }],
    { compress: 1, format: SaveFormat.PNG },
  );

  const side = Math.min(resized.width, resized.height);
  const originX = Math.max(0, Math.floor((resized.width - side) / 2));
  const originY = Math.max(0, Math.floor((resized.height - side) / 2));

  const cropped = await manipulateAsync(
    resized.uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 1, format: SaveFormat.PNG },
  );

  let finalUri = cropped.uri;
  if (side !== COLONY_PIXEL_SIZE) {
    const squared = await manipulateAsync(
      cropped.uri,
      [{ resize: { width: COLONY_PIXEL_SIZE, height: COLONY_PIXEL_SIZE } }],
      { compress: 1, format: SaveFormat.PNG },
    );
    finalUri = squared.uri;
  }

  await FileSystem.copyAsync({ from: finalUri, to: target });
  return target;
}

/** Instant URL from the baked catalog (may be null). */
export function previewSpeciesPhotoUri(
  catalogId: string,
  scientificName: string,
): string | null {
  return speciesImageUrl(catalogId, scientificName, "medium");
}

/**
 * Returns a tiny square pixelated local URI from the species reference photo.
 * Uses a larger source image before downscale for better color fidelity.
 */
export async function resolvePixelBirdUri(
  catalogId: string,
  scientificName: string,
): Promise<string | null> {
  const cacheKey = `${catalogId || scientificName}`.replace(/[^a-z0-9_-]/gi, "_");
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const job = (async () => {
    await acquireSlot();
    try {
      const remote =
        (await resolveSpeciesImageUrl(catalogId, scientificName, "large")) ?? null;
      if (!remote) return null;

      if (Platform.OS === "web") {
        const square = remote.replace(
          /\/(medium|large|original)\.(jpe?g|png)/i,
          "/square.$2",
        );
        cache.set(cacheKey, square);
        return square;
      }

      const downloadTarget = `${FileSystem.cacheDirectory ?? ""}colony-dl-${cacheKey}.jpg`;
      const downloaded = await FileSystem.downloadAsync(remote, downloadTarget);
      const pixelUri = await pixelateLocalUri(downloaded.uri, cacheKey);
      cache.set(cacheKey, pixelUri);
      return pixelUri;
    } catch {
      return null;
    } finally {
      inflight.delete(cacheKey);
      releaseSlot();
    }
  })();

  inflight.set(cacheKey, job);
  return job;
}
