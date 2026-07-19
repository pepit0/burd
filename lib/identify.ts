import { Platform } from "react-native";
import type { Prediction } from "@/types";
import { audioUploadMeta } from "@/lib/audioUpload";
import { resolveHeardSpecies } from "@/lib/heardSpecies";
import { readLocalFileBytes } from "@/lib/localFileBytes";
import { enrichPredictions } from "@/lib/predictionLabels";
import {
  getRegionalContext,
  rankLiveSoundPredictions,
  rankPredictions,
} from "@/lib/regionalFrequency";
import { applyNativeDisplayScoring, type NativeLogit } from "@/lib/soundDisplayScoring";
import { logSoundDebug, SOUND_DEBUG } from "@/lib/soundDebug";
import {
  PHOTO_AUTHENTICITY_ENABLED,
  validatePhotoAuthenticity,
} from "@/lib/photoAuthenticity";
import {
  PhotoValidationError,
  type ValidationResult,
} from "@/lib/photoValidation";

const BASE_URL = process.env.EXPO_PUBLIC_INFERENCE_URL ?? "";

/** Fly CPU inference can take 30–90s per request on a 2GB machine. */
function isRemoteInference(): boolean {
  return /fly\.dev/i.test(BASE_URL);
}

function inferenceChunkTimeoutMs(kind: "audio" | "photo"): number {
  if (isRemoteInference()) {
    return kind === "audio" ? 90_000 : 60_000;
  }
  return kind === "audio" ? 15_000 : 12_000;
}

function inferencePostTimeoutMs(): number {
  return isRemoteInference() ? 120_000 : 0;
}

function connectionUnreachableMessage(): string {
  if (isRemoteInference()) {
    return "Could not reach the identification server. Check your connection and try again.";
  }
  return `Could not reach the identification server. ${inferenceReachabilityHint()}`;
}

function isNetworkFailureMessage(message: string): boolean {
  return (
    message === "Network request failed" ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
}

function formatInferenceError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /abort/i.test(error.message)) {
      return "Identification timed out. Check your connection and try again.";
    }
    if (isNetworkFailureMessage(error.message)) {
      return connectionUnreachableMessage();
    }
    return error.message;
  }
  return "Request failed";
}

/** True when a live-chunk failure reason is likely connection-related. */
export function isInferenceConnectionIssue(reason: string): boolean {
  return /timed out|check your connection|could not reach|network request failed|failed to fetch|networkerror|you're offline|you are offline/i.test(
    reason,
  );
}

export interface IdentifyGeoOptions {
  lat?: number | null;
  lng?: number | null;
  observedAt?: string | null;
}

export interface IdentifyResult {
  predictions: Prediction[];
  heardSpecies: Prediction[];
  count: number;
  validation: ValidationResult | null;
  regionalContextApplied?: boolean;
  nativeLogits?: NativeLogit[];
}

interface IdentifyResponse extends IdentifyResult {
  model: string;
  mock: boolean;
  heard_species?: Prediction[];
  regional_context_applied?: boolean;
  native_logits?: NativeLogit[];
}

function ensureConfigured() {
  if (!BASE_URL) {
    throw new Error(
      "Identification isn't configured. Set EXPO_PUBLIC_INFERENCE_URL in your .env.",
    );
  }
}

function inferenceReachabilityHint(): string {
  if (Platform.OS === "web") {
    return "On the web app, the inference server must be a public HTTPS URL — a local IP won't work in the browser.";
  }
  return "Make sure the inference server is running and EXPO_PUBLIC_INFERENCE_URL uses your computer's LAN IP on the same Wi‑Fi as this device.";
}

function wrapInferenceNetworkError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (isNetworkFailureMessage(message)) {
    return new Error(connectionUnreachableMessage());
  }
  return error instanceof Error ? error : new Error(message);
}

function parseValidationDetail(detail: unknown): ValidationResult | null {
  if (!detail || typeof detail !== "object") return null;
  const record = detail as Record<string, unknown>;
  const validation = record.validation;
  if (!validation || typeof validation !== "object") return null;
  return validation as ValidationResult;
}

async function appendFormFile(
  form: FormData,
  field: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === "web") {
    const bytes = await readLocalFileBytes(uri);
    form.append(field, new Blob([bytes], { type: mimeType }), fileName);
    return;
  }

  form.append(field, { uri, name: fileName, type: mimeType } as unknown as Blob);
}

function appendGeoFields(form: FormData, geo?: IdentifyGeoOptions): void {
  if (!geo) return;
  if (geo.lat != null && geo.lng != null) {
    form.append("latitude", String(geo.lat));
    form.append("longitude", String(geo.lng));
  }
  if (geo.observedAt) {
    form.append("observed_at", geo.observedAt);
  }
}

function appendLiveSoundField(form: FormData, liveSound?: boolean): void {
  if (liveSound) {
    form.append("live_sound", "true");
  }
}

function appendImageValidationFields(
  form: FormData,
  options?: { livePhoto?: boolean },
): void {
  if (options?.livePhoto) {
    form.append("live_photo", "true");
  }
  if (!PHOTO_AUTHENTICITY_ENABLED) {
    form.append("skip_validation", "true");
  }
}

function applyClientRegionalRank(
  predictions: Prediction[],
  heardSpecies: Prediction[],
  geo?: IdentifyGeoOptions,
  serverApplied?: boolean,
  options?: { liveSound?: boolean; nativeLogits?: NativeLogit[] },
): { predictions: Prediction[]; heardSpecies: Prediction[] } {
  if (geo?.lat == null || geo?.lng == null) {
    return { predictions, heardSpecies };
  }

  const ctx = getRegionalContext(
    geo.lat,
    geo.lng,
    geo.observedAt ? new Date(geo.observedAt) : new Date(),
  );

  if (options?.liveSound) {
    const combined = [...predictions, ...heardSpecies];
    const rankList = (list: Prediction[]) =>
      rankLiveSoundPredictions(ctx, list, combined, options?.nativeLogits);
    return {
      predictions: rankList(predictions),
      heardSpecies: rankList(heardSpecies),
    };
  }

  if (serverApplied) {
    return { predictions, heardSpecies };
  }

  return {
    predictions: rankPredictions(ctx, predictions),
    heardSpecies: rankPredictions(ctx, heardSpecies),
  };
}

function parseIdentifyResponse(
  data: IdentifyResponse,
  geo?: IdentifyGeoOptions,
  options?: { liveSound?: boolean },
): IdentifyResult {
  let predictions = enrichPredictions(data.predictions ?? []);
  let heardSpecies = enrichPredictions(
    resolveHeardSpecies(predictions, data.heard_species),
  );

  if (options?.liveSound) {
    const displayScored = applyNativeDisplayScoring(
      predictions,
      heardSpecies,
      data.native_logits,
      geo,
    );
    predictions = displayScored.predictions;
    heardSpecies = displayScored.heardSpecies;
  }

  const ranked = applyClientRegionalRank(
    predictions,
    heardSpecies,
    geo,
    data.regional_context_applied,
    { ...options, nativeLogits: data.native_logits },
  );
  predictions = ranked.predictions;
  heardSpecies = ranked.heardSpecies;

  if (SOUND_DEBUG && options?.liveSound) {
    const serverSpecies = new Set(
      [...(data.predictions ?? []), ...(data.heard_species ?? [])].map(
        (p) => p.scientific_name ?? p.species,
      ),
    );
    const clientSpecies = new Set(
      [...predictions, ...heardSpecies].map((p) => p.scientific_name ?? p.species),
    );
    logSoundDebug(
      "chunk",
      `server ${serverSpecies.size} species → client ${clientSpecies.size} after rank`,
      {
        serverTop: (data.predictions ?? []).slice(0, 8).map((p) => ({
          name: p.scientific_name ?? p.species,
          conf: p.confidence,
        })),
        heardTop: (data.heard_species ?? []).slice(0, 8).map((p) => ({
          name: p.scientific_name ?? p.species,
          conf: p.confidence,
        })),
        clientTop: [...predictions, ...heardSpecies].slice(0, 8).map((p) => ({
          name: p.scientific_name ?? p.species,
          conf: p.confidence,
        })),
      },
    );
  }

  return {
    predictions,
    heardSpecies,
    count: data.count ?? 1,
    validation: data.validation ?? null,
    regionalContextApplied: Boolean(data.regional_context_applied),
    nativeLogits: data.native_logits,
  };
}

async function postFile(
  path: string,
  field: string,
  uri: string,
  fileName: string,
  mimeType: string,
  geo?: IdentifyGeoOptions,
  parseOptions?: { liveSound?: boolean; livePhoto?: boolean },
): Promise<IdentifyResult> {
  ensureConfigured();
  const form = new FormData();
  await appendFormFile(form, field, uri, fileName, mimeType);
  appendGeoFields(form, geo);
  appendLiveSoundField(form, parseOptions?.liveSound);
  if (path === "/identify/image") {
    appendImageValidationFields(form, { livePhoto: parseOptions?.livePhoto });
  }

  let res: Response;
  const postTimeout = inferencePostTimeoutMs();
  try {
    if (postTimeout > 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), postTimeout);
      try {
        res = await fetch(`${BASE_URL}${path}`, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } else {
      res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        body: form,
      });
    }
  } catch (error) {
    throw wrapInferenceNetworkError(
      postTimeout > 0 ? new Error(formatInferenceError(error)) : error,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 422) {
      try {
        const body = JSON.parse(text) as { detail?: unknown };
        const validation = parseValidationDetail(body.detail);
        const message =
          typeof body.detail === "object" &&
          body.detail &&
          "message" in (body.detail as object)
            ? String((body.detail as { message: unknown }).message)
            : "This photo did not pass validation.";
        if (validation?.enabled && !validation.passed) {
          throw new PhotoValidationError(message, validation);
        }
      } catch (e) {
        if (e instanceof PhotoValidationError) throw e;
      }
    }
    throw new Error(`Identification failed (${res.status}). ${text}`.trim());
  }
  const data = (await res.json()) as IdentifyResponse;
  return parseIdentifyResponse(data, geo, parseOptions);
}

export async function identifyImage(
  uri: string,
  options?: {
    skipAuthenticity?: boolean;
    base64?: string | null;
    geo?: IdentifyGeoOptions;
  },
): Promise<IdentifyResult> {
  if (PHOTO_AUTHENTICITY_ENABLED && !options?.skipAuthenticity) {
    await validatePhotoAuthenticity(uri, options?.base64);
  }
  return postFile(
    "/identify/image",
    "image",
    uri,
    "photo.jpg",
    "image/jpeg",
    options?.geo,
  );
}

/** Live camera frame identify — never throws; times out so scanning doesn't hang. */
export async function identifyImageChunkSafe(
  uri: string,
  geo?: IdentifyGeoOptions,
  timeoutMs = inferenceChunkTimeoutMs("photo"),
): Promise<IdentifyChunkOutcome> {
  if (!BASE_URL) {
    return { ok: false, reason: "Inference URL not configured" };
  }

  try {
    const form = new FormData();
    await appendFormFile(form, "image", uri, "frame.jpg", "image/jpeg");
    appendGeoFields(form, geo);
    appendImageValidationFields(form, { livePhoto: true });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${BASE_URL}/identify/image`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const reason = `Server error (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`;
        if (__DEV__) {
          console.warn("[LivePhotoId] identifyImageChunkSafe:", reason);
        }
        return { ok: false, reason };
      }

      const data = (await res.json()) as IdentifyResponse;
      return {
        ok: true,
        result: parseIdentifyResponse(data, geo),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const reason = formatInferenceError(error);
    if (__DEV__) {
      console.warn("[LivePhotoId] identifyImageChunkSafe:", reason);
    }
    return { ok: false, reason };
  }
}

export function identifyAudio(
  uri: string,
  geo?: IdentifyGeoOptions,
): Promise<IdentifyResult> {
  const { ext, contentType } = audioUploadMeta(uri);
  return postFile(
    "/identify/audio",
    "audio",
    uri,
    `clip.${ext}`,
    contentType,
    geo,
    { liveSound: true },
  );
}

export type IdentifyChunkOutcome =
  | { ok: true; result: IdentifyResult }
  | { ok: false; reason: string };

/** Live chunk identify — never throws; times out so stop doesn't hang. */
export async function identifyAudioChunkSafe(
  uri: string,
  geo?: IdentifyGeoOptions,
  timeoutMs = inferenceChunkTimeoutMs("audio"),
): Promise<IdentifyChunkOutcome> {
  if (!BASE_URL) {
    return { ok: false, reason: "Inference URL not configured" };
  }

  try {
    const { ext, contentType } = audioUploadMeta(uri);
    const form = new FormData();
    await appendFormFile(form, "audio", uri, `clip.${ext}`, contentType);
    appendGeoFields(form, geo);
    appendLiveSoundField(form, true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${BASE_URL}/identify/audio`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const reason = `Server error (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`;
        console.warn("[LiveSoundId] identifyAudioChunkSafe:", reason);
        return { ok: false, reason };
      }

      const data = (await res.json()) as IdentifyResponse;
      return {
        ok: true,
        result: parseIdentifyResponse(data, geo, { liveSound: true }),
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const reason = formatInferenceError(error);
    console.warn("[LiveSoundId] identifyAudioChunkSafe:", reason);
    return { ok: false, reason };
  }
}

export { PhotoValidationError, isPhotoValidationError, validationFailureMessage } from "@/lib/photoValidation";
export { validatePhotoAuthenticity } from "@/lib/photoAuthenticity";
