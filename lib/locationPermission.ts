import * as Location from "expo-location";

export type LocationPermissionState =
  | "loading"
  | "undetermined"
  | "granted"
  | "denied";

export interface IdentificationCoords {
  latitude: number;
  longitude: number;
}

export function locationPermissionFromStatus(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
): LocationPermissionState {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return canAskAgain ? "undetermined" : "denied";
}

/** Request foreground location and read current coordinates when granted. */
export async function ensureIdentificationLocation(): Promise<{
  permission: LocationPermissionState;
  coords: IdentificationCoords | null;
}> {
  const existing = await Location.getForegroundPermissionsAsync();
  let status = existing.status;
  let canAskAgain = existing.canAskAgain;

  if (status !== Location.PermissionStatus.GRANTED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  const permission = locationPermissionFromStatus(status, canAskAgain);
  if (permission !== "granted") {
    return { permission, coords: null };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      permission: "granted",
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return { permission: "denied", coords: null };
  }
}
