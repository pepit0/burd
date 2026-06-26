/**
 * Serial image-load gate for the field guide grid.
 * Cards register on mount; the queue releases one id at a time so photos
 * trickle in without flooding the network or re-rendering the whole list.
 */

const allowedIds = new Set<string>();
const pendingQueue: string[] = [];
const idListeners = new Map<string, Set<() => void>>();
let draining = false;

const RELEASE_GAP_MS = 180;

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
    await new Promise((resolve) => setTimeout(resolve, RELEASE_GAP_MS));
  }

  draining = false;
}

/** Request a grid photo fetch when this card is on screen. */
export function scheduleFieldGuideImage(catalogId: string): void {
  if (allowedIds.has(catalogId)) return;
  if (pendingQueue.includes(catalogId)) return;
  pendingQueue.push(catalogId);
  void drainQueue();
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
  for (const catalogId of idListeners.keys()) {
    notifyId(catalogId);
  }
}
