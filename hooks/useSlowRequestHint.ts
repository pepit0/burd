import { useEffect, useState } from "react";

/** Delay before showing a slow-connection hint during live photo frame uploads. */
export const LIVE_PHOTO_SLOW_HINT_MS = 12_000;

/** Delay before escalating the Done / identifying overlay. */
export const IDENTIFY_FINISH_SLOW_HINT_MS = 12_000;

/** Delay before showing framing coaching while Live ID has no result. */
export const LIVE_PHOTO_COACH_HINT_MS = 4_000;

export const LIVE_PHOTO_SLOW_HINT =
  "Still scanning — a slow connection may be delaying results.";

export const IDENTIFY_FINISH_SLOW_HINT =
  "Still identifying — a slow connection may be delaying this.";

export const LIVE_PHOTO_COACH_HINT =
  "Hold steady and fill the frame with the bird.";

/**
 * Returns true after `delayMs` while `active` stays true.
 * Clears immediately when `active` becomes false.
 */
export function useSlowRequestHint(active: boolean, delayMs: number): boolean {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowSlowHint(false);
      return;
    }

    setShowSlowHint(false);
    const timer = setTimeout(() => setShowSlowHint(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return showSlowHint;
}
