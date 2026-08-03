import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { MINIMUM_AGE } from "@/lib/ageRating";

type DeclaredAgeRangeModule = {
  requestAgeRangeAsync(options: {
    threshold1: number;
    threshold2?: number;
    threshold3?: number;
  }): Promise<{
    lowerBound: number | null;
    upperBound: number | null;
    ageRangeDeclaration?: "selfDeclared" | "guardianDeclared" | null;
    activeParentalControls?: string[];
  }>;
};

const declaredAgeRangeNative =
  requireOptionalNativeModule<DeclaredAgeRangeModule>("ExpoAgeRange");

export type AgeAssuranceMethod =
  | "declared_age_range"
  | "self_declared"
  | "legacy_confirmed";

export interface AgeAssuranceResult {
  allowed: boolean;
  method: AgeAssuranceMethod;
  lowerBound: number | null;
  upperBound: number | null;
  verifiedAt: string;
}

export interface AgeAssuranceFailure {
  code:
    | "under_minimum_age"
    | "user_declined"
    | "not_available"
    | "unknown";
  message: string;
}

/** True when the iOS Declared Age Range native module is linked (dev/prod build). */
export function isDeclaredAgeRangeNativeAvailable(): boolean {
  return Platform.OS === "ios" && declaredAgeRangeNative != null;
}

function usesDeclaredAgeRangeApi(): boolean {
  return isDeclaredAgeRangeNativeAvailable();
}

/** True when the account completed age verification for social features. */
export function hasAgeAssurance(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  if (typeof metadata.age_assurance_verified_at === "string") return true;
  if (!usesDeclaredAgeRangeApi() && typeof metadata.age_confirmed_at === "string") {
    return true;
  }
  return false;
}

export function isAgeAssuranceBlocked(
  metadata: Record<string, unknown> | undefined,
): boolean {
  return typeof metadata?.age_assurance_blocked_at === "string";
}

export function isSocialMediaAllowed(
  metadata: Record<string, unknown> | undefined,
): boolean {
  if (!metadata) return false;
  if (typeof metadata.age_assurance_blocked_at === "string") return false;
  if (typeof metadata.age_assurance_verified_at === "string") {
    return metadata.social_media_allowed !== false;
  }
  if (!usesDeclaredAgeRangeApi() && typeof metadata.age_confirmed_at === "string") {
    return true;
  }
  return false;
}

function isAtLeastMinimumAge(
  lowerBound: number | null,
  upperBound: number | null,
): boolean {
  if (lowerBound != null && lowerBound >= MINIMUM_AGE) return true;
  if (upperBound != null && upperBound < MINIMUM_AGE) return false;
  // Unsupported platforms return lowerBound 18; null bounds fall through to allow.
  if (lowerBound == null && upperBound == null) return true;
  return lowerBound == null && upperBound != null && upperBound >= MINIMUM_AGE;
}

function isNativeModuleMissing(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /cannot find native module/i.test(message);
}

function mapAgeRangeError(error: unknown): AgeAssuranceFailure {
  if (isNativeModuleMissing(error)) {
    return {
      code: "not_available",
      message:
        "Apple age verification requires a development or App Store build. Confirm your age manually below.",
    };
  }

  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
      ? (error as { code: string }).code
      : null;

  if (code === "ERR_AGE_RANGE_USER_DECLINED") {
    return {
      code: "user_declined",
      message:
        "Age range was not shared. You can confirm your age manually below, or sign in to your Apple Account on this device and try again.",
    };
  }

  if (code === "ERR_AGE_RANGE_NOT_AVAILABLE") {
    return {
      code: "not_available",
      message:
        "Apple age verification is unavailable on this device. Confirm your age manually below, or sign in to your Apple Account in Settings and try again.",
    };
  }

  const message =
    error instanceof Error ? error.message : "Could not verify age. Please try again.";

  return { code: "unknown", message };
}

/** Calls Apple's Declared Age Range API on iOS before enabling social features. */
export async function verifyAgeForSocialMedia(): Promise<
  AgeAssuranceResult | AgeAssuranceFailure
> {
  const verifiedAt = new Date().toISOString();

  if (!usesDeclaredAgeRangeApi()) {
    return {
      code: "not_available",
      message:
        Platform.OS === "ios"
          ? "Apple age verification requires a development or App Store build. Confirm your age manually below."
          : "Confirm your age manually to continue.",
    };
  }

  try {
    const response = await declaredAgeRangeNative!.requestAgeRangeAsync({
      threshold1: MINIMUM_AGE,
    });
    const allowed = isAtLeastMinimumAge(response.lowerBound, response.upperBound);

    if (!allowed) {
      return {
        code: "under_minimum_age",
        message: `Burd's social features are available to users age ${MINIMUM_AGE} and older.`,
      };
    }

    return {
      allowed: true,
      method: "declared_age_range",
      lowerBound: response.lowerBound,
      upperBound: response.upperBound,
      verifiedAt,
    };
  } catch (error) {
    return mapAgeRangeError(error);
  }
}

export function recordSelfDeclaredAgeAssurance(): AgeAssuranceResult {
  const verifiedAt = new Date().toISOString();
  return {
    allowed: true,
    method: "self_declared",
    lowerBound: null,
    upperBound: null,
    verifiedAt,
  };
}

export function ageAssuranceMetadataFromResult(
  result: AgeAssuranceResult,
): Record<string, string | boolean | number | null> {
  return {
    age_assurance_verified_at: result.verifiedAt,
    age_assurance_method: result.method,
    social_media_allowed: result.allowed,
    age_assurance_lower_bound: result.lowerBound,
    age_assurance_upper_bound: result.upperBound,
  };
}

export function ageAssuranceBlockedMetadata(): Record<string, string | boolean> {
  return {
    age_assurance_blocked_at: new Date().toISOString(),
    social_media_allowed: false,
  };
}
