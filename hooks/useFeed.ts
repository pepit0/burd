import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFollowingFeed,
  getForYouFeed,
  getGlobalFeed,
  getMyLikedIds,
  setLike,
} from "@/lib/sightings";
import { getErrorMessage } from "@/lib/errors";
import type { FeedSighting } from "@/types";
import type { Coords } from "@/hooks/useCurrentLocation";

export type FeedFilter = "for_you" | "following" | "new";

interface UseFeedArgs {
  filter: FeedFilter;
  userId: string | null;
  coords: Coords | null;
  radiusKm: number;
  enabled: boolean;
}

interface UseFeed {
  sightings: FeedSighting[];
  likedIds: Set<string>;
  /** First load only — does not drive pull-to-refresh. */
  loading: boolean;
  /** User-initiated pull-to-refresh only. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reload in the background (e.g. when tab refocuses). */
  silentRefresh: () => Promise<void>;
  toggleLike: (sightingId: string) => void;
}

export function useFeed({
  filter,
  userId,
  coords,
  radiusKm,
  enabled,
}: UseFeedArgs): UseFeed {
  const [sightings, setSightings] = useState<FeedSighting[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      if (!userId || !enabled) {
        if (mode === "initial") {
          setLoading(false);
        }
        return;
      }

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (mode === "initial" && !hasLoaded.current) {
        setLoading(true);
      }

      setError(null);
      try {
        let rows: FeedSighting[] = [];
        if (filter === "for_you") {
          rows = await getForYouFeed(
            userId,
            coords?.latitude ?? null,
            coords?.longitude ?? null,
            radiusKm,
          );
        } else if (filter === "following") {
          rows = await getFollowingFeed();
        } else if (filter === "new") {
          rows = await getGlobalFeed(userId);
        }
        const liked = await getMyLikedIds(userId);
        setSightings(rows);
        setLikedIds(liked);
        hasLoaded.current = true;
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, userId, coords, radiusKm, enabled],
  );

  useEffect(() => {
    hasLoaded.current = false;
    setLoading(true);
    load("initial");
  }, [load]);

  const toggleLike = useCallback(
    (sightingId: string) => {
      if (!userId) return;
      const willLike = !likedIds.has(sightingId);

      setLikedIds((prev) => {
        const next = new Set(prev);
        if (willLike) next.add(sightingId);
        else next.delete(sightingId);
        return next;
      });
      setSightings((prev) =>
        prev.map((s) =>
          s.id === sightingId
            ? { ...s, like_count: s.like_count + (willLike ? 1 : -1) }
            : s,
        ),
      );

      setLike(userId, sightingId, willLike).catch(() => {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (willLike) next.delete(sightingId);
          else next.add(sightingId);
          return next;
        });
        setSightings((prev) =>
          prev.map((s) =>
            s.id === sightingId
              ? { ...s, like_count: s.like_count + (willLike ? -1 : 1) }
              : s,
          ),
        );
      });
    },
    [userId, likedIds],
  );

  const refresh = useCallback(() => load("refresh"), [load]);
  const silentRefresh = useCallback(() => load("silent"), [load]);

  return {
    sightings,
    likedIds,
    loading,
    refreshing,
    error,
    refresh,
    silentRefresh,
    toggleLike,
  };
}
