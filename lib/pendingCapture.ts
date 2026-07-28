import type { DetectedBy, Prediction } from "@/types";

/**
 * In-memory hand-off for photos captured in a camera session. Route params
 * can't carry large base64 strings, so the camera stashes them here and the
 * new-sighting screen consumes them once.
 */
export interface SessionPhoto {
  id: string;
  uri: string;
  base64: string | null;
  capturedAt: string;
}

export interface SessionAudio {
  uri: string;
  durationMs: number;
  recordedAt: string;
}

export interface SessionAnalysis {
  detectedBy: DetectedBy;
  top: Prediction | null;
  agreed: boolean;
  imagePredictions: Prediction[];
  audioPredictions: Prediction[];
  heardSpecies: Prediction[];
  count: number;
}

export interface PendingCapture {
  photos: SessionPhoto[];
  primaryIndex: number;
  count?: number;
  audio?: SessionAudio | null;
  analysis?: SessionAnalysis;
  soundLibraryId?: string | null;
}

let pending: PendingCapture | null = null;
/** Survives React Strict Mode remounts after the log screen claims a capture. */
let claimedForSighting: PendingCapture | null = null;

export function setPendingCapture(capture: PendingCapture | null) {
  pending = capture;
  if (capture) claimedForSighting = null;
}

/** Read pending capture without clearing (safe for Strict Mode double-mount). */
export function peekPendingCapture(): PendingCapture | null {
  return claimedForSighting ?? pending;
}

/** Claim capture for the log screen — idempotent across Strict Mode remounts. */
export function claimPendingCaptureForSighting(): PendingCapture | null {
  if (claimedForSighting) return claimedForSighting;
  if (!pending) return null;
  claimedForSighting = pending;
  pending = null;
  return claimedForSighting;
}

export function clearPendingCapture(): void {
  pending = null;
  claimedForSighting = null;
}

export function takePendingCapture(): PendingCapture | null {
  const value = claimPendingCaptureForSighting();
  return value;
}
