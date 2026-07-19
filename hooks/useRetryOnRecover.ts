import { useEffect } from "react";
import { AppState } from "react-native";
import { OFFLINE_CONTENT_MESSAGE } from "@/lib/errors";

const RETRY_INTERVAL_MS = 5000;

/**
 * While an offline load error is showing, retry periodically and when the app
 * returns to the foreground so content can reappear without a manual refresh.
 */
export function useRetryOnRecover(
  error: string | null,
  retry: () => void | Promise<void>,
): void {
  useEffect(() => {
    if (error !== OFFLINE_CONTENT_MESSAGE) return;

    const run = () => {
      void retry();
    };

    const interval = setInterval(run, RETRY_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [error, retry]);
}
