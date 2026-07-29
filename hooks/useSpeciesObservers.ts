import { useEffect, useState } from "react";
import type { CatalogSpecies } from "@/lib/speciesCatalog";
import {
  fetchSpeciesObservers,
  type SpeciesObserver,
} from "@/lib/speciesObservers";

interface UseSpeciesObserversResult {
  observers: SpeciesObserver[];
  loading: boolean;
}

export function useSpeciesObservers(
  species: CatalogSpecies | undefined,
  authLoading: boolean,
  refreshKey = 0,
): UseSpeciesObserversResult {
  const [observers, setObservers] = useState<SpeciesObserver[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!species || authLoading) {
      setObservers([]);
      setLoading(Boolean(species && authLoading));
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSpeciesObservers(species)
      .then((result) => {
        if (!cancelled) setObservers(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [species?.id, authLoading, refreshKey]);

  return { observers, loading };
}
