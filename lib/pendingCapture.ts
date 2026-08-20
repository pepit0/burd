import type { LivePhotoDetection, LivePhotoDisplayRow } from "@/lib/livePhotoSession";
import type { DetectedBy, Prediction } from "@/types";

/**
 * In-memory hand-off for photos captured in a camera session. Route params
 * can't carry large base64 strings, so the camera stashes them here and the
 * new-sighting screen consumes them once.
 */
export interface SessionLiveIdentification {
  primary: LivePhotoDetection;
  displayRows: LivePhotoDisplayRow[];
}

export interface SessionPhoto {
  id: string;
  uri: string;
  base64: string | null;
  capturedAt: string;
  /** Locked Live ID from the moment this still was taken. */
  liveIdentification?: SessionLiveIdentification;
}

/** Drop in-memory Live ID + base64 before writing a draft. */
export function toPersistedSessionPhoto(photo: SessionPhoto): SessionPhoto {
  return {
    id: photo.id,
    uri: photo.uri,
    base64: null,
    capturedAt: photo.capturedAt,
  };
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
  /** Photos are ready; species should be identified on the log screen. */
  needsIdentification?: boolean;
  /** In-memory only: stills came from the in-app camera, not the gallery. */
  fromCamera?: boolean;
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
