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
