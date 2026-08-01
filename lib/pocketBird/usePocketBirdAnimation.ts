import { useEffect, useRef, useState } from "react";
import {
  POCKET_BIRD_ANIMATIONS,
  type PocketBirdAnimationId,
} from "@/lib/pocketBird/animations";
import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";
import { getPocketBirdFrame } from "@/lib/pocketBird/render";
import type { PocketBirdPixel } from "@/lib/pocketBird/render";

export function usePocketBirdAnimation(
  speciesId: string,
  animationId: PocketBirdAnimationId,
  onComplete?: () => void,
  hatId?: PocketBirdHatId,
): PocketBirdPixel[] {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const resolvedHatId = hatId ?? NO_HAT_ID;

  const [pixels, setPixels] = useState<PocketBirdPixel[]>(() =>
    getPocketBirdFrame(
      speciesId,
      POCKET_BIRD_ANIMATIONS[animationId].frames[0]!,
      resolvedHatId,
    ),
  );

  useEffect(() => {
    const def = POCKET_BIRD_ANIMATIONS[animationId];
    let frameIdx = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setPixels(getPocketBirdFrame(speciesId, def.frames[0]!, resolvedHatId));

    const advance = () => {
      if (cancelled) return;

      const duration = def.durations[frameIdx] ?? 420;
      timer = setTimeout(() => {
        if (cancelled) return;
        frameIdx += 1;
        if (frameIdx >= def.frames.length) {
          if (def.loop) {
            frameIdx = 0;
          } else {
            onCompleteRef.current?.();
            return;
          }
        }
        setPixels(getPocketBirdFrame(speciesId, def.frames[frameIdx]!, resolvedHatId));
        advance();
      }, duration);
    };

    advance();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [animationId, resolvedHatId, speciesId]);

  return pixels;
}
