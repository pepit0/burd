import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ensureIdentificationLocation,
  type IdentificationCoords,
  type LocationPermissionState,
} from "@/lib/locationPermission";

interface UseIdentificationLocationOptions {
  /** When false, skip auto-prompt until enabled (e.g. wait for camera access). */
  enabled?: boolean;
}

interface UseIdentificationLocationResult {
  coords: IdentificationCoords | null;
  permission: LocationPermissionState;
  refresh: () => Promise<IdentificationCoords | null>;
  openSettings: () => void;
  showAccuracyWarning: boolean;
}

export function useIdentificationLocation(
  options: UseIdentificationLocationOptions = {},
): UseIdentificationLocationResult {
  const { enabled = true } = options;
  const [coords, setCoords] = useState<IdentificationCoords | null>(null);
  const [permission, setPermission] = useState<LocationPermissionState>("loading");

  const refresh = useCallback(async (): Promise<IdentificationCoords | null> => {
    setPermission("loading");
    const result = await ensureIdentificationLocation();
    setPermission(result.permission);
    setCoords(result.coords);
    return result.coords;
  }, []);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void refresh();
    }, [enabled, refresh]),
  );

  return {
    coords,
    permission,
    refresh,
    openSettings,
    showAccuracyWarning: permission === "denied" || permission === "undetermined",
  };
}
