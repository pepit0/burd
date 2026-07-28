import { useCallback, useEffect, useState } from "react";
import { getRepostedSightings } from "@/lib/sightings";
import { getLoadErrorMessage } from "@/lib/errors";
import type { Sighting } from "@/types";

export function useReposts(userId: string | null) {
  const [reposts, setReposts] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setReposts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReposts(await getRepostedSightings(userId));
    } catch (e) {
      setError(getLoadErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { reposts, loading, error, refresh };
}
