import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

export type LocationStatus =
  | "loading"
  | "granted"
  | "denied"
  | "error";

export interface Coords {
  latitude: number;
  longitude: number;
}

interface UseCurrentLocation {
  coords: Coords | null;
  status: LocationStatus;
  refresh: () => Promise<void>;
}

export function useCurrentLocation(): UseCurrentLocation {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setStatus("loading");
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setStatus("granted");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { coords, status, refresh };
}
