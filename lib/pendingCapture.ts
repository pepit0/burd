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

export interface PendingCapture {
  photos: SessionPhoto[];
  primaryIndex: number;
  count?: number;
  audio?: SessionAudio | null;
}

let pending: PendingCapture | null = null;

export function setPendingCapture(capture: PendingCapture | null) {
  pending = capture;
}

export function takePendingCapture(): PendingCapture | null {
  const value = pending;
  pending = null;
  return value;
}
