import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Coords } from "@/hooks/useCurrentLocation";
import { exploreRegionLabelFromGeocode } from "@/lib/geocode";
import { getChecklistZoneLabel } from "@/lib/speciesChecklist";

export interface RegionalLocationLabel {
  city: string;
  region: string;
  display: string;
}

export function useRegionalLocationLabel(coords: Coords | null) {
  const [label, setLabel] = useState<RegionalLocationLabel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coords) {
      setLabel(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const places = await Location.reverseGeocodeAsync(coords);
        const place = places[0];
        if (cancelled) return;

        if (place) {
          const display = exploreRegionLabelFromGeocode(place);
          const zone = getChecklistZoneLabel(coords.latitude, coords.longitude);

          setLabel({
            city: place.subregion?.trim() || place.city?.trim() || zone || "",
            region: place.region?.trim() ?? "",
            display: display || zone || "your area",
          });
          return;
        }
      } catch {
        // fall through to ecozone label
      }

      if (!cancelled) {
        const zone = getChecklistZoneLabel(coords.latitude, coords.longitude);
        setLabel({
          city: zone ?? "",
          region: "",
          display: zone ?? "your area",
        });
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude]);

  return { label, loading };
}
