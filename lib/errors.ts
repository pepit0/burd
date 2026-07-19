/**
 * Supabase / PostgREST errors are plain objects ({ message, details, hint, code }),
 * not Error instances, so `instanceof Error` misses them. This pulls out a useful
 * human-readable message from whatever was thrown.
 */
export function getErrorMessage(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;

  if (typeof e === "object") {
    const err = e as Record<string, unknown>;
    const parts = [err.message, err.details, err.hint]
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown error";
    }
  }
  return String(e);
}

/** Shown when a screen fails to load because the device is offline or the network is unreachable. */
export const OFFLINE_CONTENT_MESSAGE =
  "You're offline. Page content will reappear when your connection is restored.";

const DEFAULT_USER_FACING =
  "Something went wrong. Please try again.";

const OFFLINE_ACTION_MESSAGE =
  "You're offline. Check your connection and try again.";

const NETWORK_MESSAGE_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /internet connection appears to be offline/i,
  /the network connection was lost/i,
  /nsurlerrordomain/i,
  /econnrefused/i,
  /enotfound/i,
  /socket hang up/i,
  /load failed/i,
  /^\s*typeerror\b/i,
];

/** True when the failure is likely offline / unreachable network (not an app bug). */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof TypeError) return true;

  if (typeof error === "object") {
    const name = (error as { name?: unknown }).name;
    if (name === "TypeError" || name === "NetworkError") return true;
  }

  return NETWORK_MESSAGE_PATTERNS.some((pattern) =>
    pattern.test(getErrorMessage(error)),
  );
}

const TECHNICAL_MESSAGE_PATTERNS = [
  /\barraybuffer\b/i,
  /\barraybufferview\b/i,
  /\bblob\b/i,
  /\bformdata\b/i,
  /network request failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /expo_public_/i,
  /\.(ts|tsx|js|jsx):/i,
  /identification failed \(\d+\)/i,
  /undefined is not/i,
  /cannot read propert/i,
  /^\s*typeerror\b/i,
  /^\s*\{.*"detail"/,
  /^\s*\[/,
];

function looksTechnical(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  // Keep connection-oriented identify messages for the UI.
  if (
    /check your connection|could not reach the identification server|identification timed out/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Strip dev-only details before showing an error in the UI. */
export function getUserFacingMessage(
  error: unknown,
  fallback = DEFAULT_USER_FACING,
): string {
  if (isNetworkError(error)) {
    return fallback === DEFAULT_USER_FACING ? OFFLINE_ACTION_MESSAGE : fallback;
  }
  const raw = getErrorMessage(error);
  if (looksTechnical(raw)) return fallback;
  return raw;
}

/** Message for page / list load failures (feed, journal, profile, etc.). */
export function getLoadErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return OFFLINE_CONTENT_MESSAGE;
  return getUserFacingMessage(
    error,
    "Something went wrong. Pull to refresh and try again.",
  );
}

/** Read the JSON error body from a Supabase Edge Function invoke failure. */
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context &&
    typeof (error.context as Response).json === "function"
  ) {
    try {
      const body = (await (error.context as Response).json()) as {
        error?: string;
        message?: string;
      };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // fall through
    }
  }
  return getErrorMessage(error);
}
