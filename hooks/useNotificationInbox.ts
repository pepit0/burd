import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearActivity,
  clearAllActivity,
  getActivity,
  markActivityRead,
  markAllActivityRead,
} from "@/lib/activity";
import { getLoadErrorMessage } from "@/lib/errors";
import { useRetryOnRecover } from "@/hooks/useRetryOnRecover";
import type { ActivityItem } from "@/types";

interface UseNotificationInbox {
  notifications: ActivityItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearOne: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useNotificationInbox(
  userId: string | null,
  enabled = true,
): UseNotificationInbox {
  const [notifications, setNotifications] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!userId || !enabled) return;

      if (mode === "refresh") {
        setRefreshing(true);
      } else if (!hasLoaded.current) {
        setLoading(true);
      }

      try {
        setNotifications(await getActivity(userId));
        hasLoaded.current = true;
        setError(null);
      } catch (e) {
        setError(getLoadErrorMessage(e));
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
    load("initial");
  }, [load, enabled]);

  const refresh = useCallback(() => load("refresh"), [load]);

  useRetryOnRecover(error, refresh);

  const markRead = useCallback(async (id: string) => {
    await markActivityRead(id);
    setNotifications((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, read_at: new Date().toISOString() } : row,
      ),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await markAllActivityRead(userId);
    const now = new Date().toISOString();
    setNotifications((rows) => rows.map((row) => ({ ...row, read_at: row.read_at ?? now })));
  }, [userId]);

  const clearOne = useCallback(async (id: string) => {
    await clearActivity(id);
    setNotifications((rows) => rows.filter((row) => row.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await clearAllActivity(userId);
    setNotifications([]);
  }, [userId]);

  return {
    notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
    clearOne,
    clearAll,
  };
}
