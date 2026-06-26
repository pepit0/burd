import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFollowCounts,
  getMyProfile,
  updateProfileAvatarUrl,
  updateSearchRadius,
  uploadAvatarPhoto,
} from "@/lib/sightings";
import { getErrorMessage } from "@/lib/errors";
import type { Profile } from "@/types";

interface UseProfile {
  profile: Profile | null;
  followers: number;
  following: number;
  /** First load only — does not drive pull-to-refresh. */
  loading: boolean;
  /** User-initiated pull-to-refresh only. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reload in the background (e.g. when tab refocuses). */
  silentRefresh: () => Promise<void>;
  setRadius: (km: number) => Promise<void>;
  updateAvatar: (base64: string, ext?: string) => Promise<void>;
}

export function useProfile(userId: string | null): UseProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
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

      setError(null);
      try {
        const [p, counts] = await Promise.all([
          getMyProfile(userId),
          getFollowCounts(userId),
        ]);
        setProfile(p);
        setFollowers(counts.followers);
        setFollowing(counts.following);
        hasLoaded.current = true;
      } catch (e) {
        setError(getErrorMessage(e));
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
    async (km: number) => {
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

  const refresh = useCallback(() => load("refresh"), [load]);
  const silentRefresh = useCallback(() => load("silent"), [load]);

  return {
    profile,
    followers,
    following,
    loading,
    refreshing,
    error,
    refresh,
    silentRefresh,
    setRadius,
    updateAvatar,
  };
}
