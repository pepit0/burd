import type { Prediction } from "@/types";
import { validatePhotoAuthenticity } from "@/lib/photoAuthenticity";
import {
  PhotoValidationError,
  type ValidationResult,
} from "@/lib/photoValidation";

const BASE_URL = process.env.EXPO_PUBLIC_INFERENCE_URL ?? "";

export interface IdentifyResult {
  predictions: Prediction[];
  count: number;
  validation: ValidationResult | null;
}

interface IdentifyResponse extends IdentifyResult {
  model: string;
  mock: boolean;
}

function ensureConfigured() {
  if (!BASE_URL) {
    throw new Error(
      "Identification isn't configured. Set EXPO_PUBLIC_INFERENCE_URL in your .env.",
    );
  }
}

function parseValidationDetail(detail: unknown): ValidationResult | null {
  if (!detail || typeof detail !== "object") return null;
  const record = detail as Record<string, unknown>;
  const validation = record.validation;
  if (!validation || typeof validation !== "object") return null;
  return validation as ValidationResult;
}

async function postFile(
  path: string,
  field: string,
  uri: string,
  fileName: string,
  mimeType: string,
): Promise<IdentifyResult> {
  ensureConfigured();
  const form = new FormData();
  // React Native FormData accepts a { uri, name, type } file object.
  form.append(field, { uri, name: fileName, type: mimeType } as unknown as Blob);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: form,
  });
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
  return {
    predictions: data.predictions ?? [],
    count: data.count ?? 1,
    validation: data.validation ?? null,
  };
}

export async function identifyImage(
  uri: string,
  options?: { skipAuthenticity?: boolean; base64?: string | null },
): Promise<IdentifyResult> {
  if (!options?.skipAuthenticity) {
    await validatePhotoAuthenticity(uri, options?.base64);
  }
  return postFile("/identify/image", "image", uri, "photo.jpg", "image/jpeg");
}

export function identifyAudio(uri: string): Promise<IdentifyResult> {
  return postFile("/identify/audio", "audio", uri, "clip.m4a", "audio/m4a");
}

export { PhotoValidationError, isPhotoValidationError, validationFailureMessage } from "@/lib/photoValidation";
export { validatePhotoAuthenticity } from "@/lib/photoAuthenticity";
