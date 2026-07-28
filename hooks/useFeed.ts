import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFollowingFeed,
  getForYouFeed,
  getGlobalFeed,
  getMyLikedIds,
  setLike,
} from "@/lib/sightings";
import { getLoadErrorMessage } from "@/lib/errors";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
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

interface FeedCacheEntry {
  sightings: FeedSighting[];
  likedIds: Set<string>;
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
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const cacheRef = useRef<Partial<Record<FeedFilter, FeedCacheEntry>>>({});

  const writeCache = useCallback(
    (activeFilter: FeedFilter, rows: FeedSighting[], liked: Set<string>) => {
      cacheRef.current[activeFilter] = {
        sightings: rows,
        likedIds: new Set(liked),
      };
    },
    [],
  );

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      if (!userId || !enabled) {
        if (mode === "initial") {
          setLoading(false);
        }
        return;
      }

      const activeFilter = filterRef.current;

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (mode === "initial" && !hasLoaded.current) {
        setLoading(true);
      }

      if (mode !== "silent") {
        setError(null);
      }

      try {
        let rows: FeedSighting[] = [];
        if (activeFilter === "for_you") {
          rows = await getForYouFeed(
            userId,
            coords?.latitude ?? null,
            coords?.longitude ?? null,
            radiusKm,
          );
        } else if (activeFilter === "following") {
          rows = await getFollowingFeed(userId);
        } else if (activeFilter === "new") {
          rows = await getGlobalFeed();
        }
        const liked = await getMyLikedIds(userId);
        writeCache(activeFilter, rows, liked);
        if (filterRef.current !== activeFilter) return;
        setSightings(rows);
        setLikedIds(liked);
        hasLoaded.current = true;
        setError(null);
      } catch (e) {
        if (filterRef.current === activeFilter) {
          setError(getLoadErrorMessage(e));
        }
      } finally {
        if (filterRef.current === activeFilter) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId, coords, radiusKm, enabled, writeCache],
  );

  useEffect(() => {
    if (!enabled) return;

    const cached = cacheRef.current[filter];
    if (cached) {
      setSightings(cached.sightings);
      setLikedIds(new Set(cached.likedIds));
      hasLoaded.current = true;
      setLoading(false);
      void load("silent");
      return;
    }

    hasLoaded.current = false;
    setLoading(true);
    void load("initial");
  }, [load, enabled, filter]);

  const toggleLike = useCallback(
    (sightingId: string) => {
      if (!userId) return;
      const activeFilter = filterRef.current;
      const willLike = !likedIds.has(sightingId);

      setLikedIds((prev) => {
        const next = new Set(prev);
        if (willLike) next.add(sightingId);
        else next.delete(sightingId);
        const cached = cacheRef.current[activeFilter];
        if (cached) {
          cacheRef.current[activeFilter] = { ...cached, likedIds: next };
        }
        return next;
      });
      setSightings((prev) => {
        const next = prev.map((s) =>
          s.id === sightingId
            ? { ...s, like_count: s.like_count + (willLike ? 1 : -1) }
            : s,
        );
        const cached = cacheRef.current[activeFilter];
        if (cached) {
          cacheRef.current[activeFilter] = { ...cached, sightings: next };
        }
        return next;
      });

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

  useRetryOnRecover(error, silentRefresh);

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
