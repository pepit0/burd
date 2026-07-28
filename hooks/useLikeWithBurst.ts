import { useCallback, useState } from "react";
import { nextLikeBurstKey } from "@/components/LikeBurstOverlay";
import { triggerLikeHaptic } from "@/lib/haptics";

interface UseLikeWithBurstArgs {
  liked: boolean;
  onToggleLike: () => void;
}

function likeSideEffects(setBurstKey: (update: (key: number) => number) => void) {
  triggerLikeHaptic();
  setBurstKey((key) => nextLikeBurstKey(key));
}

export function useLikeWithBurst({ liked, onToggleLike }: UseLikeWithBurstArgs) {
  const [burstKey, setBurstKey] = useState(0);

  const likeWithBurst = useCallback(() => {
    if (!liked) {
      likeSideEffects(setBurstKey);
    }
    onToggleLike();
  }, [liked, onToggleLike]);

  const likeWithBurstIfNeeded = useCallback(() => {
    if (liked) return;
    likeSideEffects(setBurstKey);
    onToggleLike();
  }, [liked, onToggleLike]);

  return { burstKey, likeWithBurst, likeWithBurstIfNeeded };
}
