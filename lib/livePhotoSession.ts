import { enrichPrediction } from "@/lib/predictionLabels";
import { catalogIdFromScientific } from "@/lib/photoCatalog";
import {
  getRegionalContext,
  scorePrediction,
  type RegionalContext,
} from "@/lib/regionalFrequency";
import {
  getCatalogSpeciesByScientificName,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";
import type { IdentifyResult } from "@/lib/identify";
import type { Prediction } from "@/types";

export const LIVE_PHOTO_INTERVAL_MS = 2500;
export const LIVE_PHOTO_DETECTION_TTL_MS = 8000;
export const LIVE_PHOTO_MIN_CONFIDENCE = 0.05;
export const LIVE_PHOTO_STRONG_CONFIDENCE = 0.12;
export const LIVE_PHOTO_MIN_HITS = 2;

export interface LivePhotoDetection {
  key: string;
  prediction: Prediction;
  peakConfidence: number;
  lastSeenAt: number;
  catalogId: string | null;
  hitCount: number;
}

export interface LivePhotoDisplayRow {
  detection: LivePhotoDetection;
  isExpiring: boolean;
  isInFrame: boolean;
}

function detectionKey(prediction: Prediction): string {
  const enriched = enrichPrediction(prediction);
  return (
    enriched.scientific_name?.trim().toLowerCase() ||
    enriched.species.trim().toLowerCase()
  );
}

function catalogIdFor(prediction: Prediction): string | null {
  const enriched = enrichPrediction(prediction);
  const fromPhoto = catalogIdFromScientific(enriched.scientific_name);
  if (fromPhoto) return fromPhoto;
  const byScientific = enriched.scientific_name
    ? getCatalogSpeciesByScientificName(enriched.scientific_name)
    : undefined;
  if (byScientific) return byScientific.id;
  return (
    resolveCatalogSpecies(enriched.species, enriched.scientific_name)?.id ?? null
  );
}

function regionalContextFor(
  coords: { latitude: number; longitude: number } | null,
  observedAt: string,
): RegionalContext | null {
  if (!coords) return null;
  return getRegionalContext(
    coords.latitude,
    coords.longitude,
    new Date(observedAt),
  );
}

function passesDisplayThreshold(detection: LivePhotoDetection): boolean {
  if (detection.peakConfidence < LIVE_PHOTO_MIN_CONFIDENCE) return false;
  if (detection.peakConfidence >= LIVE_PHOTO_STRONG_CONFIDENCE) return true;
  return detection.hitCount >= LIVE_PHOTO_MIN_HITS;
}

/** Strong enough Live ID to skip a full Done re-identify. */
export function canReuseLivePhotoDetection(
  detection: LivePhotoDetection | null | undefined,
): detection is LivePhotoDetection {
  if (!detection) return false;
  return (
    detection.peakConfidence >= LIVE_PHOTO_STRONG_CONFIDENCE &&
    detection.hitCount >= LIVE_PHOTO_MIN_HITS
  );
}

function sortDetections(
  detections: LivePhotoDetection[],
  ctx: RegionalContext | null,
): LivePhotoDetection[] {
  return [...detections].sort((a, b) => {
    const scoreDiff =
      scorePrediction(ctx, b.prediction) - scorePrediction(ctx, a.prediction);
    if (scoreDiff !== 0) return scoreDiff;
    return b.peakConfidence - a.peakConfidence;
  });
}

function upsertDetection(
  detections: Map<string, LivePhotoDetection>,
  prediction: Prediction,
  now: number,
): void {
  const enriched = enrichPrediction(prediction);
  const key = detectionKey(enriched);
  if (!key) return;

  const existing = detections.get(key);
  if (existing) {
    detections.set(key, {
      ...existing,
      prediction:
        enriched.confidence > existing.prediction.confidence
          ? enriched
          : existing.prediction,
      peakConfidence: Math.max(existing.peakConfidence, enriched.confidence),
      lastSeenAt: now,
      hitCount: existing.hitCount + 1,
      catalogId: existing.catalogId ?? catalogIdFor(enriched),
    });
    return;
  }

  detections.set(key, {
    key,
    prediction: enriched,
    peakConfidence: enriched.confidence,
    lastSeenAt: now,
    catalogId: catalogIdFor(enriched),
    hitCount: 1,
  });
}

export function mergePhotoFramePredictions(
  detections: Map<string, LivePhotoDetection>,
  chunk: IdentifyResult,
  now: number,
): Map<string, LivePhotoDetection> {
  const next = new Map(detections);
  for (const raw of chunk.predictions) {
    upsertDetection(next, raw, now);
  }
  return next;
}

export function highlightKeysFromPhotoFrame(
  chunk: IdentifyResult,
): Set<string> {
  const keys = new Set<string>();
  for (const raw of chunk.predictions) {
    const enriched = enrichPrediction(raw);
    if (enriched.confidence < LIVE_PHOTO_MIN_CONFIDENCE) continue;
    const key = detectionKey(enriched);
    if (key) keys.add(key);
  }
  return keys;
}

export function displayPhotoDetections(
  detections: Map<string, LivePhotoDetection>,
  now: number,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
  inFrameKeys: Set<string> = new Set(),
  ttlMs = LIVE_PHOTO_DETECTION_TTL_MS,
  fadeMs = 600,
): LivePhotoDisplayRow[] {
  const ctx = regionalContextFor(coords, observedAt);
  const visible = [...detections.values()]
    .filter((entry) => now - entry.lastSeenAt <= ttlMs + fadeMs)
    .filter((entry) => passesDisplayThreshold(entry));

  return sortDetections(visible, ctx).map((entry) => ({
    detection: entry,
    isExpiring: now - entry.lastSeenAt > ttlMs,
    isInFrame: inFrameKeys.has(entry.key),
  }));
}
