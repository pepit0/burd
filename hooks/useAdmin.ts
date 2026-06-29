import { useCallback, useEffect, useState } from "react";
import { getMyAccountStatus } from "@/lib/moderation";

interface UseAdminResult {
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAdmin(userId: string | null): UseAdminResult {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(!!userId);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const status = await getMyAccountStatus(userId);
      setIsAdmin(status.role === "admin");
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { isAdmin, loading, refresh };
}
