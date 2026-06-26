import { useCallback, useEffect, useRef, useState } from "react";
import { getMySightings } from "@/lib/sightings";
import { getErrorMessage } from "@/lib/errors";
import type { Sighting } from "@/types";

interface UseMySightings {
  sightings: Sighting[];
  /** First load only — does not drive pull-to-refresh. */
  loading: boolean;
  /** User-initiated pull-to-refresh only. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reload in the background (e.g. when tab refocuses). */
  silentRefresh: () => Promise<void>;
}

export function useMySightings(userId: string | null): UseMySightings {
  const [sightings, setSightings] = useState<Sighting[]>([]);
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
        setSightings(await getMySightings(userId));
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

  const refresh = useCallback(() => load("refresh"), [load]);
  const silentRefresh = useCallback(() => load("silent"), [load]);

  return { sightings, loading, refreshing, error, refresh, silentRefresh };
}
