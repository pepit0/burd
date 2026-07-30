import type { DetectedBy } from "@/types";
import type { SessionPhoto } from "@/lib/pendingCapture";

export interface PhotoEntryDraft {
  id: string;
  /** Original capture from camera or library — never replaced after crop. */
  sourceUri: string;
  sourceBase64: string | null;
  uri: string;
  base64: string | null;
  displayUri: string | null;
  framed: boolean;
  capturedAt: string;
  species: string;
  scientific: string;
  count: number;
  confidence: number | null;
  detectedBy: DetectedBy;
}

export function newPhotoEntryId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPhotoEntryDraft(
  photo: Pick<SessionPhoto, "id" | "uri" | "base64" | "capturedAt">,
  displayUri: string | null,
  meta?: Partial<
    Pick<
      PhotoEntryDraft,
      | "species"
      | "scientific"
      | "count"
      | "confidence"
      | "detectedBy"
      | "framed"
    >
  >,
): PhotoEntryDraft {
  return {
    id: photo.id,
    sourceUri: photo.uri,
    sourceBase64: photo.base64,
    uri: photo.uri,
    base64: photo.base64,
    displayUri,
    framed: meta?.framed ?? true,
    capturedAt: photo.capturedAt,
    species: meta?.species ?? "",
    scientific: meta?.scientific ?? "",
    count: meta?.count ?? 1,
    confidence: meta?.confidence ?? null,
    detectedBy: meta?.detectedBy ?? "manual",
  };
}

export function updatePhotoEntryDraft(
  entries: PhotoEntryDraft[],
  id: string,
  patch: Partial<PhotoEntryDraft>,
): PhotoEntryDraft[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
}

export function syncActivePhotoMetadata(
  entries: PhotoEntryDraft[],
  activeId: string | null,
  metadata: Pick<
    PhotoEntryDraft,
    "species" | "scientific" | "count" | "confidence" | "detectedBy"
  >,
): PhotoEntryDraft[] {
  if (!activeId) return entries;
  return updatePhotoEntryDraft(entries, activeId, metadata);
}

export function allPhotoEntriesFramed(entries: PhotoEntryDraft[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.framed);
}

export function firstUnframedPhoto(entries: PhotoEntryDraft[]): PhotoEntryDraft | null {
  return entries.find((entry) => !entry.framed) ?? null;
}

interface BootstrapPhotoInput {
  sessionPhotos: SessionPhoto[];
  primaryPhotoId: string | null;
  photoUri: string | null;
  photoBase64: string | null;
  species: string;
  scientific: string;
  count: number;
  confidence: number | null;
  detectedBy: DetectedBy;
  observedAt: Date;
}

export function buildInitialPhotoEntries(
  bootstrap: BootstrapPhotoInput,
  normalizeUri: (uri: string | null, base64: string | null) => string | null,
): PhotoEntryDraft[] {
  if (bootstrap.sessionPhotos.length > 0) {
    const primaryId =
      bootstrap.primaryPhotoId ?? bootstrap.sessionPhotos[0]?.id ?? null;
    return bootstrap.sessionPhotos.map((photo) => {
      const isPrimary = photo.id === primaryId;
      return createPhotoEntryDraft(
        photo,
        normalizeUri(photo.uri, photo.base64),
        isPrimary
          ? {
              species: bootstrap.species,
              scientific: bootstrap.scientific,
              count: bootstrap.count,
              confidence: bootstrap.confidence,
              detectedBy: bootstrap.detectedBy,
            }
          : undefined,
      );
    });
  }

  if (bootstrap.photoUri) {
    return [
      createPhotoEntryDraft(
        {
          id: newPhotoEntryId(),
          uri: bootstrap.photoUri,
          base64: bootstrap.photoBase64,
          capturedAt: bootstrap.observedAt.toISOString(),
        },
        normalizeUri(bootstrap.photoUri, bootstrap.photoBase64),
        {
          species: bootstrap.species,
          scientific: bootstrap.scientific,
          count: bootstrap.count,
          confidence: bootstrap.confidence,
          detectedBy: bootstrap.detectedBy,
        },
      ),
    ];
  }

  return [];
}
