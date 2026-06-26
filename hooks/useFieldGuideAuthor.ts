import { useEffect, useState } from "react";
import type { CatalogSpecies } from "@/lib/speciesCatalog";
import {
  fetchFieldGuideAuthor,
  type FieldGuideAuthor,
} from "@/lib/speciesFieldGuideAuthor";

interface UseFieldGuideAuthorResult {
  author: FieldGuideAuthor | null;
  loading: boolean;
}

export function useFieldGuideAuthor(
  species: CatalogSpecies | undefined,
  authLoading: boolean,
  refreshKey = 0,
): UseFieldGuideAuthorResult {
  const [author, setAuthor] = useState<FieldGuideAuthor | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!species || authLoading) {
      setAuthor(null);
      setLoading(Boolean(species && authLoading));
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchFieldGuideAuthor(species)
      .then((result) => {
        if (!cancelled) setAuthor(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [species?.id, authLoading, refreshKey]);

  return { author, loading };
}
