import { useCallback, useRef, useState } from "react";
import {
  nextSendOffKey,
  POST_SEND_OFF_DURATION_MS,
} from "@/components/PostSendOffOverlay";
import { triggerPostHaptic } from "@/lib/haptics";

export function usePostSendOff() {
  const [sendOffKey, setSendOffKey] = useState(0);
  const resolveRef = useRef<(() => void) | null>(null);

  const onSendOffComplete = useCallback(() => {
    resolveRef.current?.();
    resolveRef.current = null;
  }, []);

  const playSendOff = useCallback((): Promise<void> => {
    void triggerPostHaptic();
    setSendOffKey((key) => nextSendOffKey(key));

    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setTimeout(() => {
        if (resolveRef.current === resolve) {
          resolveRef.current = null;
          resolve();
        }
      }, POST_SEND_OFF_DURATION_MS + 120);
    });
  }, []);

  return { sendOffKey, playSendOff, onSendOffComplete };
}
