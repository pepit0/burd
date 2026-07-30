import { useCallback, useEffect, useState } from "react";
import { getBlockedUserIds } from "@/lib/blocks";

export function useBlockedUsers(userId: string | null) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setBlockedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      setBlockedIds(await getBlockedUserIds(userId));
    } catch {
      setBlockedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const blockLocally = useCallback((blockedId: string) => {
    setBlockedIds((prev) => new Set([...prev, blockedId]));
  }, []);

  const unblockLocally = useCallback((blockedId: string) => {
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
  }, []);

  return { blockedIds, loading, refresh, blockLocally, unblockLocally };
}
