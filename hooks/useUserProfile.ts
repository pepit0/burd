import { useCallback, useEffect, useState } from "react";
import {
  getFollowCounts,
  getMyProfile,
  getMySightings,
} from "@/lib/sightings";
import { followUser, isFollowing, unfollowUser } from "@/lib/social";
import { getErrorMessage } from "@/lib/errors";
import type { Profile, Sighting } from "@/types";

interface UseUserProfile {
  profile: Profile | null;
  followers: number;
  following: number;
  sightings: Sighting[];
  followingThem: boolean;
  isSelf: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleFollow: () => Promise<void>;
}

export function useUserProfile(
  targetId: string | null,
  currentUserId: string | null,
): UseUserProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [followingThem, setFollowingThem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSelf = !!targetId && targetId === currentUserId;

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, counts, s, follows] = await Promise.all([
        getMyProfile(targetId),
        getFollowCounts(targetId),
        getMySightings(targetId, { publishedOnly: true }),
        !isSelf && currentUserId
          ? isFollowing(currentUserId, targetId)
          : Promise.resolve(false),
      ]);
      setProfile(p);
      setFollowers(counts.followers);
      setFollowing(counts.following);
      setSightings(s.filter((row) => !row.removed_at));
      setFollowingThem(follows);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [targetId, currentUserId, isSelf]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    if (!currentUserId || !targetId || isSelf) return;
    const willFollow = !followingThem;
    setFollowingThem(willFollow);
    setFollowers((c) => c + (willFollow ? 1 : -1));
    const action = willFollow ? followUser : unfollowUser;
    try {
      await action(currentUserId, targetId);
    } catch {
      setFollowingThem(!willFollow);
      setFollowers((c) => c + (willFollow ? -1 : 1));
    }
  }, [currentUserId, targetId, isSelf, followingThem]);

  return {
    profile,
    followers,
    following,
    sightings,
    followingThem,
    isSelf,
    loading,
    error,
    refresh: load,
    toggleFollow,
  };
}
