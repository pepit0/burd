import { isNetworkError } from "@/lib/errors";

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry async work when the failure looks like a transient network issue. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = options?.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = isNetworkError(error) && attempt < attempts - 1;
      if (!canRetry) throw error;
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}
