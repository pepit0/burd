import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { SessionPhoto } from "@/lib/pendingCapture";

const STORAGE_KEY = "burd.captureDrafts.v1";
const DRAFTS_ROOT = `${FileSystem.documentDirectory ?? ""}capture-drafts`;

export const IDENTIFY_DONE_BUDGET_MS = 20_000;

export interface CaptureDraftGeo {
  lat: number;
  lng: number;
  observedAt: string;
}

export interface CaptureDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  photos: SessionPhoto[];
  primaryIndex: number;
  geo?: CaptureDraftGeo | null;
  /** True while the camera session is still open; false after Done saved-for-later. */
  inProgress: boolean;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureDraftDir(draftId: string): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error("Local storage is not available on this device.");
  }
  const root = DRAFTS_ROOT;
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
  const dir = `${root}/${draftId}`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function readIndex(): Promise<CaptureDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CaptureDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(drafts: CaptureDraft[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

/** Copy a camera temp JPEG into durable document storage. */
export async function persistSessionPhoto(
  draftId: string,
  photo: SessionPhoto,
): Promise<SessionPhoto> {
  const dir = await ensureDraftDir(draftId);
  const dest = `${dir}/${photo.id}.jpg`;
  await FileSystem.copyAsync({ from: photo.uri, to: dest });
  return {
    id: photo.id,
    uri: dest,
    base64: null,
    capturedAt: photo.capturedAt,
  };
}

export async function createCaptureDraftId(): Promise<string> {
  return newId();
}

export async function upsertCaptureDraft(draft: CaptureDraft): Promise<void> {
  const drafts = await readIndex();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  const next = { ...draft, updatedAt: new Date().toISOString() };
  if (idx >= 0) drafts[idx] = next;
  else drafts.unshift(next);
  drafts.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  await writeIndex(drafts);
}

export async function listCaptureDrafts(): Promise<CaptureDraft[]> {
  const drafts = await readIndex();
  const existing: CaptureDraft[] = [];
  for (const draft of drafts) {
    const primary = draft.photos[draft.primaryIndex] ?? draft.photos[0];
    if (!primary?.uri) continue;
    const info = await FileSystem.getInfoAsync(primary.uri);
    if (info.exists) existing.push(draft);
  }
  if (existing.length !== drafts.length) {
    await writeIndex(existing);
  }
  return existing;
}

export async function getCaptureDraft(
  id: string,
): Promise<CaptureDraft | null> {
  const drafts = await listCaptureDrafts();
  return drafts.find((d) => d.id === id) ?? null;
}

export async function deleteCaptureDraft(id: string): Promise<void> {
  const drafts = await readIndex();
  await writeIndex(drafts.filter((d) => d.id !== id));
  if (!FileSystem.documentDirectory) return;
  const dir = `${DRAFTS_ROOT}/${id}`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
  } catch {
    // Best-effort cleanup
  }
}

/** Read a local photo file as base64 for upload (drafts store URIs only). */
export async function readPhotoBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function pendingFromDraft(draft: CaptureDraft) {
  return {
    photos: draft.photos,
    primaryIndex: draft.primaryIndex,
  };
}
