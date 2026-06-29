/**
 * Serial image-load gate for the field guide grid.
 * Cards register on mount; the queue releases one id at a time so photos
 * trickle in without flooding the network or re-rendering the whole list.
 */

import { speciesImageUrl } from "@/lib/speciesImages";

const allowedIds = new Set<string>();
const pendingQueue: string[] = [];
const idListeners = new Map<string, Set<() => void>>();
let draining = false;

const RELEASE_GAP_MS = 180;
/** First screenful loads without stagger so cover photos appear immediately. */
const INITIAL_BURST = 10;
let burstRemaining = INITIAL_BURST;

function notifyId(catalogId: string): void {
  idListeners.get(catalogId)?.forEach((listener) => listener());
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;

  while (pendingQueue.length > 0) {
    const catalogId = pendingQueue.shift();
    if (!catalogId || allowedIds.has(catalogId)) continue;

    allowedIds.add(catalogId);
    notifyId(catalogId);

    if (burstRemaining > 0) {
      burstRemaining -= 1;
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, RELEASE_GAP_MS));
  }

  draining = false;
}

/** Request a grid photo fetch when this card is on screen. */
export function scheduleFieldGuideImage(catalogId: string): void {
  if (allowedIds.has(catalogId)) return;

  // Baked catalog URLs render instantly — no queue slot needed.
  if (speciesImageUrl(catalogId)) {
    allowedIds.add(catalogId);
    notifyId(catalogId);
    return;
  }

  if (pendingQueue.includes(catalogId)) return;
  pendingQueue.push(catalogId);
  void drainQueue();
}

/** Ensure every visible grid card is queued (e.g. after search/sort reset). */
export function primeFieldGuideImages(catalogIds: string[]): void {
  for (const catalogId of catalogIds) {
    scheduleFieldGuideImage(catalogId);
  }
}

export function isFieldGuideImageAllowed(catalogId: string): boolean {
  return allowedIds.has(catalogId);
}

export function subscribeFieldGuideImage(
  catalogId: string,
  listener: () => void,
): () => void {
  let set = idListeners.get(catalogId);
  if (!set) {
    set = new Set();
    idListeners.set(catalogId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set?.size === 0) idListeners.delete(catalogId);
  };
}

export function resetFieldGuideImageLoader(): void {
  allowedIds.clear();
  pendingQueue.length = 0;
  draining = false;
  burstRemaining = INITIAL_BURST;

  // Re-queue mounted cards. Clearing the queue alone left them stuck because
  // canFetch stayed false and the schedule effect did not re-run.
  for (const catalogId of idListeners.keys()) {
    scheduleFieldGuideImage(catalogId);
  }
}
