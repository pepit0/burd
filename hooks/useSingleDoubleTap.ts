import { useCallback, useEffect, useRef } from "react";

/** Single tap after a pause; double tap within `delayMs` fires `onDouble` instead. */
export function useSingleDoubleTap(
  onSingle: () => void,
  onDouble: () => void,
  delayMs = 280,
) {
  const lastTapRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, []);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current <= delayMs) {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      lastTapRef.current = 0;
      onDouble();
      return;
    }

    lastTapRef.current = now;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      lastTapRef.current = 0;
      onSingle();
    }, delayMs);
  }, [delayMs, onDouble, onSingle]);
}
