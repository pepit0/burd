import * as Location from "expo-location";
import { applyGeocodeFields } from "@/lib/geocode";
import { enrichPrediction } from "@/lib/predictionLabels";
import { inferRegionalRarity } from "@/lib/rarity";
import {
  BLUE_JAY_KEY,
  checklistNativeLeader,
  getRegionalContext,
  scorePrediction,
  shouldShowLiveSoundPrediction,
  type NativeLogitInput,
  type RegionalContext,
} from "@/lib/regionalFrequency";
import {
  isInSoundTaxonomy,
  scientificKeyForSoundPrediction,
} from "@/lib/soundTaxonomy";
import {
  getCatalogSpeciesByScientificName,
  resolveCatalogSpecies,
} from "@/lib/speciesCatalog";
import { createSighting, getMyProfile } from "@/lib/sightings";
import { maybeGenerateSpeciesProfileAfterSighting } from "@/lib/speciesProfileLoad";
import {
  linkSoundToSighting,
  saveSoundToLibrary,
} from "@/lib/soundLibrary";
import type { IdentifyResult } from "@/lib/identify";
import type { Prediction } from "@/types";

export const LIVE_DETECTION_TTL_MS = 20_000;

/** Minimum recorded audio before sending a chunk to Perch (matches server). */
export const LIVE_MIN_RECORDING_MS = 1000;

/** Minimum confidence to accumulate a detection from a chunk. */
export const LIVE_DISPLAY_MIN_CONFIDENCE = 0.05;
/** Strong single-chunk detection — show immediately when geo-passing. */
export const LIVE_DISPLAY_STRONG_CONFIDENCE = 0.15;
/** Weaker detections need repeated chunk hits before display. */
export const LIVE_MIN_CHUNK_HITS = 2;
/** Minimum confidence for temporal consensus without strong single-chunk hit. */
export const LIVE_DISPLAY_CONSENSUS_CONFIDENCE = 0.1;
/** Heard-species max-pool can surface a species missed by mean scoring. */
export const LIVE_HEARD_MERGE_MIN_CONFIDENCE = 0.05;
/** Minimum peak confidence to include in the stop-session summary (non-Jay). */
export const SESSION_SUMMARY_MIN_CONFIDENCE = 0.08;
/** Blue Jay session summary needs stronger evidence. */
export const SESSION_SUMMARY_JAY_MIN_CONFIDENCE = 0.1;
export const SESSION_SUMMARY_JAY_CONSENSUS_CONFIDENCE = 0.08;
export const SESSION_SUMMARY_JAY_MIN_HITS = 2;
/** Blue Jay live display when it is the checklist acoustic leader. */
export const LIVE_DISPLAY_JAY_LEADER_MIN_CONFIDENCE = 0.05;
/** Final session summary size when recording stops. */
export const SESSION_SUMMARY_TOP_K = 10;

export interface LiveDetection {
  key: string;
  prediction: Prediction;
  peakConfidence: number;
  lastSeenAt: number;
  catalogId: string | null;
  hitCount: number;
}

export interface SessionSegment {
  uri: string;
  durationMs: number;
}

export interface FinalizeLiveSessionInput {
  userId: string;
  segments: SessionSegment[];
  detections: Map<string, LiveDetection>;
  coords: { latitude: number; longitude: number } | null;
  recordedAt: string;
  observedAt: string;
  /** User-selected journal primary; defaults to top session detection. */
  primaryDetectionKey?: string | null;
}

export type FinalizeLiveSessionResult =
  | {
      kind: "journal";
      sightingId: string;
      species: string;
      scientificName: string | null;
      soundLibraryId: string;
    }
  | {
      kind: "library_only";
      message: string;
      soundLibraryId: string;
    };

export interface LiveSessionReview {
  sessionPredictions: Prediction[];
  sessionDetections: LiveDetection[];
  top: LiveDetection | null;
  totalDurationMs: number;
  longestUri: string;
}

function detectionKey(prediction: Prediction): string {
  return scientificKeyForSoundPrediction(prediction);
}

function catalogIdFor(prediction: Prediction): string | null {
  const enriched = enrichPrediction(prediction);
  const byScientific = enriched.scientific_name
    ? getCatalogSpeciesByScientificName(
        scientificKeyForSoundPrediction(enriched),
      )
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

function sortDetections(
  detections: LiveDetection[],
  ctx: RegionalContext | null,
): LiveDetection[] {
  return [...detections].sort((a, b) => {
    const scoreDiff =
      scorePrediction(ctx, b.prediction) - scorePrediction(ctx, a.prediction);
    if (scoreDiff !== 0) return scoreDiff;
    return b.peakConfidence - a.peakConfidence;
  });
}

function passesDisplayThreshold(
  detection: LiveDetection,
  ctx: RegionalContext | null,
  pool: Prediction[],
  nativeLogits?: NativeLogitInput[],
): boolean {
  const key = scientificKeyForSoundPrediction(detection.prediction);
  if (!isInSoundTaxonomy(key)) return false;
  if (detection.peakConfidence < LIVE_DISPLAY_MIN_CONFIDENCE) return false;

  const gatePrediction: Prediction = {
    ...detection.prediction,
    confidence: detection.peakConfidence,
  };
  if (
    !shouldShowLiveSoundPrediction(ctx, gatePrediction, pool, nativeLogits)
  ) {
    return false;
  }

  if (detection.peakConfidence >= LIVE_DISPLAY_STRONG_CONFIDENCE) return true;
  if (
    ctx &&
    nativeLogits?.length &&
    key === BLUE_JAY_KEY &&
    detection.peakConfidence >= LIVE_DISPLAY_JAY_LEADER_MIN_CONFIDENCE &&
    checklistNativeLeader(ctx, nativeLogits)?.key === BLUE_JAY_KEY
  ) {
    return true;
  }
  if (detection.peakConfidence >= LIVE_DISPLAY_CONSENSUS_CONFIDENCE) return true;
  // Merlin-style: geo-valid species at min confidence show on first chunk.
  return true;
}

function passesSessionSummaryThreshold(detection: LiveDetection): boolean {
  const key = scientificKeyForSoundPrediction(detection.prediction);
  if (!isInSoundTaxonomy(key)) return false;
  if (key === BLUE_JAY_KEY) {
    return (
      detection.peakConfidence >= SESSION_SUMMARY_JAY_MIN_CONFIDENCE ||
      (detection.peakConfidence >= SESSION_SUMMARY_JAY_CONSENSUS_CONFIDENCE &&
        detection.hitCount >= SESSION_SUMMARY_JAY_MIN_HITS)
    );
  }
  return detection.peakConfidence >= SESSION_SUMMARY_MIN_CONFIDENCE;
}

function sortSessionSummary(
  detections: LiveDetection[],
  ctx: RegionalContext | null,
): LiveDetection[] {
  return [...detections].sort((a, b) => {
    if (b.hitCount !== a.hitCount) {
      return b.hitCount - a.hitCount;
    }
    const scoreDiff =
      scorePrediction(ctx, b.prediction) - scorePrediction(ctx, a.prediction);
    if (scoreDiff !== 0) return scoreDiff;
    return b.peakConfidence - a.peakConfidence;
  });
}

function upsertDetection(
  detections: Map<string, LiveDetection>,
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

export function mergeChunkPredictions(
  detections: Map<string, LiveDetection>,
  chunk: IdentifyResult,
  now: number,
): Map<string, LiveDetection> {
  const next = new Map(detections);

  for (const raw of chunk.predictions) {
    upsertDetection(next, raw, now);
  }

  for (const raw of chunk.heardSpecies) {
    const enriched = enrichPrediction(raw);
    if (enriched.confidence < LIVE_HEARD_MERGE_MIN_CONFIDENCE) continue;
    upsertDetection(next, enriched, now);
  }

  return next;
}

/** Species in this chunk that pass live display gates — eligible for "Now" highlight. */
export function highlightSpeciesKeysFromChunk(
  chunk: IdentifyResult,
  coords: { latitude: number; longitude: number } | null,
  observedAt: string,
  nativeLogits?: NativeLogitInput[],
): Set<string> {
  const ctx = regionalContextFor(coords, observedAt);
  const byKey = new Map<string, Prediction>();

  for (const raw of [...chunk.predictions, ...chunk.heardSpecies]) {
    const enriched = enrichPrediction(raw);
    if (enriched.confidence < LIVE_HEARD_MERGE_MIN_CONFIDENCE) continue;
    const key = detectionKey(enriched);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || enriched.confidence > existing.confidence) {
      byKey.set(key, enriched);
    }
  }

  const pool = [...byKey.values()];
  const keys = new Set<string>();
  const now = Date.now();

  for (const [key, prediction] of byKey) {
    const detection: LiveDetection = {
      key,
      prediction,
      peakConfidence: prediction.confidence,
      lastSeenAt: now,
      catalogId: catalogIdFor(prediction),
      hitCount: 1,
    };
    if (passesDisplayThreshold(detection, ctx, pool, nativeLogits)) {
      keys.add(key);
    }
  }

  return keys;
}

/** Returns detections visible in the UI, including a short fade-out window. */
export function displayDetections(
  detections: Map<string, LiveDetection>,
  now: number,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
  ttlMs = LIVE_DETECTION_TTL_MS,
  fadeMs = 800,
  nativeLogits?: NativeLogitInput[],
): { detection: LiveDetection; isExpiring: boolean }[] {
  const ctx = regionalContextFor(coords, observedAt);
  const pool = [...detections.values()].map((entry) => ({
    ...entry.prediction,
    confidence: entry.peakConfidence,
  }));
  const visible = [...detections.values()]
    .filter((entry) => now - entry.lastSeenAt <= ttlMs + fadeMs)
    .filter((entry) =>
      passesDisplayThreshold(entry, ctx, pool, nativeLogits),
    );

  return sortDetections(visible, ctx).map((entry) => ({
    detection: entry,
    isExpiring: now - entry.lastSeenAt > ttlMs,
  }));
}

/** Returns detections still within TTL, sorted by regional score. */
export function activeDetections(
  detections: Map<string, LiveDetection>,
  now: number,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
  ttlMs = LIVE_DETECTION_TTL_MS,
  nativeLogits?: NativeLogitInput[],
): LiveDetection[] {
  const ctx = regionalContextFor(coords, observedAt);
  const pool = [...detections.values()].map((entry) => ({
    ...entry.prediction,
    confidence: entry.peakConfidence,
  }));
  return sortDetections(
    [...detections.values()]
      .filter((entry) => now - entry.lastSeenAt <= ttlMs)
      .filter((entry) =>
        passesDisplayThreshold(entry, ctx, pool, nativeLogits),
      ),
    ctx,
  );
}

/** Top session species by consistency across windows, then geo score. */
export function pickSessionSummary(
  detections: Map<string, LiveDetection>,
  limit = SESSION_SUMMARY_TOP_K,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
): LiveDetection[] {
  const ctx = regionalContextFor(coords, observedAt);
  return sortSessionSummary(
    [...detections.values()].filter((entry) =>
      passesSessionSummaryThreshold(entry),
    ),
    ctx,
  ).slice(0, limit);
}

export function pickSessionTop(
  detections: Map<string, LiveDetection>,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
): LiveDetection | null {
  return pickSessionSummary(detections, 1, coords, observedAt)[0] ?? null;
}

export function predictionsFromDetections(
  detections: Map<string, LiveDetection>,
  coords: { latitude: number; longitude: number } | null = null,
  observedAt: string = new Date().toISOString(),
): Prediction[] {
  return pickSessionSummary(detections, SESSION_SUMMARY_TOP_K, coords, observedAt).map(
    (entry) => ({
      ...entry.prediction,
      confidence: entry.peakConfidence,
    }),
  );
}

function libraryLabelForReview(
  review: LiveSessionReview,
  primary: LiveDetection | null = review.top,
): string | null {
  const count = review.sessionPredictions.length;
  if (count === 0) return null;
  if (primary) {
    return enrichPrediction(primary.prediction).species;
  }
  if (count === 1) {
    return review.sessionPredictions[0]?.species ?? null;
  }
  return `Sound session (${count} species)`;
}

function resolvePrimaryDetection(
  review: LiveSessionReview,
  primaryDetectionKey?: string | null,
): LiveDetection | null {
  if (primaryDetectionKey) {
    const chosen = review.sessionDetections.find(
      (detection) => detection.key === primaryDetectionKey,
    );
    if (chosen) return chosen;
  }
  return review.top;
}

function pickLongestSegment(segments: SessionSegment[]): SessionSegment | null {
  if (segments.length === 0) return null;
  return segments.reduce((best, segment) =>
    segment.durationMs > best.durationMs ? segment : best,
  );
}

async function resolveGeocodeFields(
  coords: { latitude: number; longitude: number } | null,
): Promise<{ city: string | null; address: string | null; label: string | null }> {
  if (!coords) {
    return { city: null, address: null, label: null };
  }

  try {
    const geo = await Location.reverseGeocodeAsync(coords);
    const place = geo[0];
    if (!place) return { city: null, address: null, label: null };
    const { city, address, label } = applyGeocodeFields(place);
    return {
      city: city || null,
      address: address || null,
      label: label || null,
    };
  } catch {
    return { city: null, address: null, label: null };
  }
}

export function buildLiveSessionReview(
  input: Omit<FinalizeLiveSessionInput, "userId">,
): LiveSessionReview {
  const longest = pickLongestSegment(input.segments);
  if (!longest) {
    throw new Error("No audio was captured during this session.");
  }

  const totalDurationMs = input.segments.reduce((sum, s) => sum + s.durationMs, 0);
  const summary = pickSessionSummary(
    input.detections,
    SESSION_SUMMARY_TOP_K,
    input.coords,
    input.observedAt,
  );
  const sessionPredictions = summary.map((entry) => ({
    ...entry.prediction,
    confidence: entry.peakConfidence,
  }));
  const top = summary[0] ?? null;

  return {
    sessionPredictions,
    sessionDetections: summary,
    top,
    totalDurationMs,
    longestUri: longest.uri,
  };
}

/** Save live session to journal only (not posted to profile). */
export async function saveLiveSessionToJournal(
  input: FinalizeLiveSessionInput,
): Promise<FinalizeLiveSessionResult> {
  const {
    userId,
    segments,
    detections,
    coords,
    recordedAt,
    observedAt,
    primaryDetectionKey,
  } = input;
  const review = buildLiveSessionReview({
    segments,
    detections,
    coords,
    recordedAt,
    observedAt,
  });

  const primary = resolvePrimaryDetection(review, primaryDetectionKey);

  const libraryEntry = await saveSoundToLibrary(userId, {
    localUri: review.longestUri,
    durationMs: review.totalDurationMs,
    recordedAt,
    predictions: review.sessionPredictions,
    label: libraryLabelForReview(review, primary),
  });

  if (!primary) {
    return {
      kind: "library_only",
      message: "Clip saved to your sound library.",
      soundLibraryId: libraryEntry.id,
    };
  }

  const enriched = enrichPrediction(primary.prediction);
  const geocode = await resolveGeocodeFields(coords);
  const profile = await getMyProfile(userId);
  const radiusKm = profile?.search_radius_km ?? 25;
  const rarity = await inferRegionalRarity(
    enriched.species,
    enriched.scientific_name,
    coords?.latitude ?? null,
    coords?.longitude ?? null,
    radiusKm,
    observedAt,
  );

  const sightingId = await createSighting(userId, {
    species: enriched.species,
    scientific_name: enriched.scientific_name,
    location_name: geocode.label,
    location_city: geocode.city,
    location_address: geocode.address,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    observed_at: observedAt,
    rarity,
    count: 1,
    audio_url: libraryEntry.audio_url,
    audio_predictions: review.sessionPredictions,
    confidence: primary.peakConfidence,
    detected_by: "audio",
    publish: false,
  });

  await linkSoundToSighting(libraryEntry.id, sightingId);

  void maybeGenerateSpeciesProfileAfterSighting(
    enriched.species,
    enriched.scientific_name,
    null,
  );

  return {
    kind: "journal",
    sightingId,
    species: enriched.species,
    scientificName: enriched.scientific_name,
    soundLibraryId: libraryEntry.id,
  };
}

/** @deprecated Use buildLiveSessionReview + saveLiveSessionToJournal from the UI. */
export async function finalizeLiveSession(
  input: FinalizeLiveSessionInput,
): Promise<FinalizeLiveSessionResult> {
  return saveLiveSessionToJournal(input);
}
