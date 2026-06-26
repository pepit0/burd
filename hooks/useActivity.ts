import { useCallback, useEffect, useRef, useState } from "react";
import { getActivity } from "@/lib/activity";
import { getErrorMessage } from "@/lib/errors";
import type { ActivityItem } from "@/types";

interface UseActivity {
  activity: ActivityItem[];
  /** First load only — does not drive pull-to-refresh. */
  loading: boolean;
  /** User-initiated pull-to-refresh only. */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reload in the background (e.g. when tab refocuses). */
  silentRefresh: () => Promise<void>;
}

export function useActivity(userId: string | null, enabled: boolean): UseActivity {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      if (!userId || !enabled) return;

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (mode === "initial" && !hasLoaded.current) {
        setLoading(true);
      }

      setError(null);
      try {
        setActivity(await getActivity(userId));
        hasLoaded.current = true;
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, enabled],
  );

  useEffect(() => {
    if (!enabled) {
      hasLoaded.current = false;
      return;
    }
    hasLoaded.current = false;
    setLoading(true);
    load("initial");
  }, [load, enabled]);

  const refresh = useCallback(() => load("refresh"), [load]);
  const silentRefresh = useCallback(() => load("silent"), [load]);

  return { activity, loading, refreshing, error, refresh, silentRefresh };
}
