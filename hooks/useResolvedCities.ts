import { useEffect, useState } from "react";
import { resolveSightingCity, sightingCity } from "@/lib/sightingFormat";
import type { Sighting } from "@/types";

/** Reverse-geocodes sightings that are missing a saved city (cached per id). */
export function useResolvedCities(sightings: Sighting[]) {
  const [cities, setCities] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const sighting of sightings) {
        if (cancelled) break;

        const city = await resolveSightingCity(sighting);
        if (cancelled) break;

        setCities((prev) =>
          prev[sighting.id] === city ? prev : { ...prev, [sighting.id]: city },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sightings]);

  return (sighting: Sighting) => cities[sighting.id] ?? sightingCity(sighting);
}
