import type { DistanceUnit } from "@/types";

const KM_TO_MI = 0.621371;
const MI_TO_KM = 1.60934;

export function formatDistance(km: number, unit: DistanceUnit): string {
  if (unit === "mi") {
    const mi = km * KM_TO_MI;
    return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
  }
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function formatRadiusLabel(km: number | null, unit: DistanceUnit): string {
  if (km == null) return "No limit";
  return formatDistance(km, unit);
}

export function kmToDisplay(km: number, unit: DistanceUnit): number {
  return unit === "mi" ? km * KM_TO_MI : km;
}

export function displayToKm(value: number, unit: DistanceUnit): number {
  return unit === "mi" ? value * MI_TO_KM : value;
}

export const RADIUS_KM_OPTIONS: (number | null)[] = [null, 5, 10, 25, 50, 75, 100];

export function radiusOptionsForUnit(unit: DistanceUnit): { km: number | null; label: string }[] {
  return RADIUS_KM_OPTIONS.map((km) => ({
    km,
    label: formatRadiusLabel(km, unit),
  }));
}

export const DISTANCE_UNIT_OPTIONS: { id: DistanceUnit; label: string }[] = [
  { id: "km", label: "Kilometers" },
  { id: "mi", label: "Miles" },
];
