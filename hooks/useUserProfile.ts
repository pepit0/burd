import { useCallback, useEffect, useState } from "react";
import {
  getMyProfile,
  getMySightings,
} from "@/lib/sightings";
import { getFriendCounts } from "@/lib/social";
import { getLoadErrorMessage } from "@/lib/errors";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import type { Profile, Sighting } from "@/types";

interface UseUserProfile {
  profile: Profile | null;
  friends: number;
  sightings: Sighting[];
  status: import("@/lib/social").FriendshipStatus;
  isSelf: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleFriend: () => Promise<void>;
  declineRequest: () => Promise<void>;
}

export function useUserProfile(
  targetId: string | null,
  currentUserId: string | null,
): UseUserProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState(0);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [status, setStatus] = useState<import("@/lib/social").FriendshipStatus>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSelf = !!targetId && targetId === currentUserId;

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [p, counts, s, rel] = await Promise.all([
        getMyProfile(targetId),
        getFriendCounts(targetId),
        getMySightings(targetId, { publishedOnly: true }),
        !isSelf && currentUserId
          ? (await import("@/lib/social")).getFriendshipStatus(currentUserId, targetId)
          : Promise.resolve("none" as import("@/lib/social").FriendshipStatus),
      ]);
      setProfile(p);
      setFriends(counts.friends);
      setSightings(s.filter((row) => !row.removed_at));
      setStatus(rel);
      setError(null);
    } catch (e) {
      setError(getLoadErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [targetId, currentUserId, isSelf]);

  useEffect(() => {
    load();
  }, [load]);

  useRetryOnRecover(error, load);

  const toggleFriend = useCallback(async () => {
    if (!currentUserId || !targetId || isSelf) return;
    const { acceptFriendRequest, cancelFriendRequest, sendFriendRequest, unfriendUser } =
      await import("@/lib/social");

    const prev = status;
    const apply = (next: import("@/lib/social").FriendshipStatus) => setStatus(next);

    try {
      if (prev === "friends") {
        apply("none");
        await unfriendUser(targetId);
        return;
      }
      if (prev === "outgoing") {
        apply("none");
        await cancelFriendRequest(targetId);
        return;
      }
      if (prev === "incoming") {
        apply("friends");
        await acceptFriendRequest(targetId);
        return;
      }
      apply("outgoing");
      await sendFriendRequest(targetId);
    } catch {
      apply(prev);
    }
  }, [currentUserId, targetId, isSelf, status]);

  const declineRequest = useCallback(async () => {
    if (!currentUserId || !targetId || isSelf) return;
    if (status !== "incoming") return;
    const { declineFriendRequest } = await import("@/lib/social");
    const prev = status;
    setStatus("none");
    try {
      await declineFriendRequest(targetId);
    } catch {
      setStatus(prev);
    }
  }, [currentUserId, targetId, isSelf, status]);

  return {
    profile,
    friends,
    sightings,
    status,
    isSelf,
    loading,
    error,
    refresh: load,
    toggleFriend,
    declineRequest,
  };
}
