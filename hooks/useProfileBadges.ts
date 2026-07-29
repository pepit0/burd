import { useEffect, useMemo, useState } from "react";
import {
  buildProfileBadges,
  fetchProfileBadgeExtras,
  type ProfileBadge,
  type ProfileBadgeExtras,
} from "@/lib/profileBadges";
import type { Sighting } from "@/types";

const DEFAULT_EXTRAS: ProfileBadgeExtras = {
  commentsLeft: 0,
  likesReceived: 0,
  repostsGiven: 0,
  fieldGuideAuthorCredits: 0,
};

export function useProfileBadges(
  userId: string | null,
  sightings: Sighting[],
  friends: number,
): { badges: ProfileBadge[]; earnedCount: number; loadingExtras: boolean } {
  const [extras, setExtras] = useState<ProfileBadgeExtras>(DEFAULT_EXTRAS);
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (!userId) {
      setExtras(DEFAULT_EXTRAS);
      return;
    }

    let cancelled = false;
    setLoadingExtras(true);
    void fetchProfileBadgeExtras(userId)
      .then((data) => {
        if (!cancelled) setExtras(data);
      })
      .catch(() => {
        if (!cancelled) setExtras(DEFAULT_EXTRAS);
      })
      .finally(() => {
        if (!cancelled) setLoadingExtras(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const badges = useMemo(
    () =>
      buildProfileBadges({
        sightings,
        friends,
        extras,
      }),
    [sightings, friends, extras],
  );

  const earnedCount = useMemo(() => badges.filter((badge) => badge.earned).length, [badges]);

  return { badges, earnedCount, loadingExtras };
}
