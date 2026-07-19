import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getUnreadActivityCount } from "@/lib/activity";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

interface NotificationBadgeContextValue {
  unreadCount: number;
  refresh: () => Promise<void>;
}

const NotificationBadgeContext = createContext<NotificationBadgeContextValue | null>(
  null,
);

export function NotificationBadgeProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refresh = useCallback(async () => {
    if (!userIdRef.current) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadActivityCount());
    } catch (e) {
      console.warn("Failed to load unread count:", getUserFacingMessage(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`activity-badge:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo(
    () => ({
      unreadCount,
      refresh,
    }),
    [unreadCount, refresh],
  );

  return (
    <NotificationBadgeContext.Provider value={value}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export function useNotificationBadge(): NotificationBadgeContextValue {
  const context = useContext(NotificationBadgeContext);
  if (!context) {
    throw new Error("useNotificationBadge must be used within NotificationBadgeProvider");
  }
  return context;
}
