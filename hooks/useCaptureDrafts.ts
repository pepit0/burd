import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  listCaptureDrafts,
  deleteCaptureDraft,
  type CaptureDraft,
} from "@/lib/captureDrafts";

export function useCaptureDrafts() {
  const [drafts, setDrafts] = useState<CaptureDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await listCaptureDrafts();
      setDrafts(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCaptureDraft(id);
      await refresh();
    },
    [refresh],
  );

  return { drafts, loading, refresh, remove };
}
