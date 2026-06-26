import { encode } from "base64-arraybuffer";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { getFunctionErrorMessage } from "@/lib/errors";
import {
  PhotoValidationError,
  type ValidationResult,
} from "@/lib/photoValidation";

export type PhotoAuthenticityClass =
  | "real"
  | "screen"
  | "reproduction"
  | "ai"
  | "stock";

export type PhotoAuthStatus = "idle" | "checking" | "passed" | "failed";

interface AuthenticityResponse {
  classification?: PhotoAuthenticityClass;
  passed?: boolean;
  message?: string;
  error?: string;
}

function validationError(message: string): PhotoValidationError {
  return new PhotoValidationError(message, {
    enabled: true,
    passed: false,
    checks: [
      {
        id: "authenticity",
        passed: false,
        score: 0,
        message,
      },
    ],
  });
}

function normalizeResponse(data: unknown): AuthenticityResponse | null {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as AuthenticityResponse;
    } catch {
      return null;
    }
  }
  if (typeof data === "object") {
    return data as AuthenticityResponse;
  }
  return null;
}

async function parseInvokeResponse(
  data: unknown,
  error: Error | null,
): Promise<AuthenticityResponse> {
  const normalized = normalizeResponse(data);
  if (normalized) return normalized;

  if (error) {
    const message = await getFunctionErrorMessage(error);
    throw validationError(message);
  }

  throw validationError("Could not validate this photo right now. Try again.");
}

/** Downscale before sending to the vision API (faster, more reliable on mobile). */
export async function preparePhotoForAuthenticity(
  uri: string,
  _existingBase64?: string | null,
): Promise<{ base64: string; mediaType: string }> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  if (manipulated.base64) {
    return { base64: manipulated.base64, mediaType: "image/jpeg" };
  }

  const response = await fetch(manipulated.uri);
  if (!response.ok) {
    throw validationError("Could not read the selected photo.");
  }
  const buffer = await response.arrayBuffer();
  return { base64: encode(buffer), mediaType: "image/jpeg" };
}

/** Vision check that the photo is a genuine in-the-field capture. */
export async function validatePhotoAuthenticity(
  uri: string,
  existingBase64?: string | null,
): Promise<void> {
  const { base64, mediaType } = await preparePhotoForAuthenticity(uri, existingBase64);

  const { data, error } = await supabase.functions.invoke<AuthenticityResponse>(
    "photo-authenticity",
    {
      body: {
        image_base64: base64,
        media_type: mediaType,
      },
    },
  );

  const response = await parseInvokeResponse(data, error);

  if (response.error) {
    throw validationError(response.error);
  }

  if (response.passed === true && response.classification === "real") {
    return;
  }

  const message =
    response.message ??
    "This photo did not pass validation. Please use your own genuine photograph.";

  throw validationError(message);
}

/** Same as validatePhotoAuthenticity but returns a status for UI gating. */
export async function checkPhotoAuthenticity(
  uri: string,
  existingBase64?: string | null,
): Promise<{ status: "passed" | "failed"; message?: string; validation?: ValidationResult }> {
  try {
    await validatePhotoAuthenticity(uri, existingBase64);
    return { status: "passed" };
  } catch (e) {
    if (e instanceof PhotoValidationError) {
      return {
        status: "failed",
        message: e.message,
        validation: e.validation,
      };
    }
    return {
      status: "failed",
      message: e instanceof Error ? e.message : "Could not validate this photo.",
    };
  }
}
