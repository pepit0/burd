import { useEffect, useRef } from "react";
import { useBadgeUnlock } from "@/components/BadgeUnlockProvider";
import type { ProfileBadge } from "@/lib/profileBadges";

/** Call on the signed-in user's profile to detect and celebrate newly earned badges. */
export function useBadgeUnlockSync(
  enabled: boolean,
  badges: ProfileBadge[],
  ready: boolean,
) {
  const { syncEarnedBadges } = useBadgeUnlock();
  const signatureRef = useRef("");

  useEffect(() => {
    if (!enabled || !ready) return;

    const earnedIds = badges
      .filter((badge) => badge.earned)
      .map((badge) => badge.id)
      .sort()
      .join(",");

    if (earnedIds === signatureRef.current) return;
    signatureRef.current = earnedIds;
    void syncEarnedBadges(badges);
  }, [enabled, ready, badges, syncEarnedBadges]);
}
