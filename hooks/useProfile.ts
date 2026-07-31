import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyProfile,
  updateProfileAvatarUrl,
  updateProfileDetails,
  updateProfileShowcaseBadges,
  updateSearchRadius,
  uploadAvatarPhoto,
  type ProfileDetailsUpdate,
} from "@/lib/sightings";
import { getFriendCounts } from "@/lib/social";
import { getLoadErrorMessage } from "@/lib/errors";
import { useFriendshipChangeListener } from "@/hooks/useFriendshipChangeListener";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import type { Profile } from "@/types";

interface UseProfile {
  profile: Profile | null;
  friends: number;
  incomingRequests: number;
  /** First load only — does not drive pull-to-refresh. */
  loading: boolean;
  /** User-initiated pull-to-refresh only. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reload in the background (e.g. when tab refocuses). */
  silentRefresh: () => Promise<void>;
  setRadius: (km: number | null) => Promise<void>;
  updateAvatar: (base64: string, ext?: string) => Promise<void>;
  updateDetails: (fields: ProfileDetailsUpdate) => Promise<void>;
  updateShowcaseBadges: (badgeIds: string[]) => Promise<void>;
}

export function useProfile(userId: string | null): UseProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState(0);
  const [incomingRequests, setIncomingRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      if (!userId) return;

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (mode === "initial" && !hasLoaded.current) {
        setLoading(true);
      }

      if (mode !== "silent") {
        setError(null);
      }

      try {
        const [p, counts] = await Promise.all([getMyProfile(userId), getFriendCounts(userId)]);
        setProfile(p);
        setFriends(counts.friends);
        setIncomingRequests(counts.incoming);
        hasLoaded.current = true;
        setError(null);
      } catch (e) {
        setError(getLoadErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    hasLoaded.current = false;
    setLoading(true);
    load("initial");
  }, [load]);

  const setRadius = useCallback(
    async (km: number | null) => {
      if (!userId || !profile) return;
      const prev = profile.search_radius_km;
      setProfile({ ...profile, search_radius_km: km });
      try {
        await updateSearchRadius(userId, km);
      } catch {
        setProfile((p) => (p ? { ...p, search_radius_km: prev } : p));
      }
    },
    [userId, profile],
  );

  const updateAvatar = useCallback(
    async (base64: string, ext = "jpg") => {
      if (!userId || !profile) return;
      const prev = profile.avatar_url;
      try {
        const avatarUrl = await uploadAvatarPhoto(userId, base64, ext);
        await updateProfileAvatarUrl(userId, avatarUrl);
        setProfile({ ...profile, avatar_url: avatarUrl });
      } catch (e) {
        setProfile((p) => (p ? { ...p, avatar_url: prev } : p));
        throw e;
      }
    },
    [userId, profile],
  );

  const updateDetails = useCallback(
    async (fields: ProfileDetailsUpdate) => {
      if (!userId || !profile) return;
      const prev = {
        full_name: profile.full_name,
        bio: profile.bio,
        cover_url: profile.cover_url,
      };
      setProfile({ ...profile, ...fields });
      try {
        await updateProfileDetails(userId, fields);
      } catch (e) {
        setProfile((p) => (p ? { ...p, ...prev } : p));
        throw e;
      }
    },
    [userId, profile],
  );

  const updateShowcaseBadges = useCallback(
    async (badgeIds: string[]) => {
      if (!userId || !profile) return;
      const prev = profile.showcase_badge_ids ?? [];
      setProfile({ ...profile, showcase_badge_ids: badgeIds });
      try {
        await updateProfileShowcaseBadges(userId, badgeIds);
      } catch (e) {
        setProfile((p) => (p ? { ...p, showcase_badge_ids: prev } : p));
        throw e;
      }
    },
    [userId, profile],
  );

  const refresh = useCallback(() => load("refresh"), [load]);
  const silentRefresh = useCallback(() => load("silent"), [load]);

  useRetryOnRecover(error, silentRefresh);

  useFriendshipChangeListener(() => {
    void load("silent");
  });

  return {
    profile,
    friends,
    incomingRequests,
    loading,
    refreshing,
    error,
    refresh,
    silentRefresh,
    setRadius,
    updateAvatar,
    updateDetails,
    updateShowcaseBadges,
  };
}
