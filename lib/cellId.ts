/** 1° grid for North America bundle. */
export const NA_GRID_DEG = 1;
/** 2° grid for global bundle. */
export const GLOBAL_GRID_DEG = 2;

export const NA_BBOX = {
  minLat: 15,
  maxLat: 72,
  minLng: -170,
  maxLng: -50,
};

export function cellIdForCoords(
  lat: number,
  lng: number,
  gridDeg: number,
): string {
  const latBand = Math.floor(lat / gridDeg) * gridDeg;
  const lngBand = Math.floor(lng / gridDeg) * gridDeg;
  return `${latBand}_${lngBand}`;
}

export function isInNaBbox(lat: number, lng: number): boolean {
  return (
    lat >= NA_BBOX.minLat &&
    lat <= NA_BBOX.maxLat &&
    lng >= NA_BBOX.minLng &&
    lng <= NA_BBOX.maxLng
  );
}

export function gridDegForCoords(lat: number, lng: number): number {
  return isInNaBbox(lat, lng) ? NA_GRID_DEG : GLOBAL_GRID_DEG;
}

export function cellIdFromLatLng(lat: number, lng: number): string {
  return cellIdForCoords(lat, lng, gridDegForCoords(lat, lng));
}

export function bundleRegionForCoords(lat: number, lng: number): "na" | "global" {
  return isInNaBbox(lat, lng) ? "na" : "global";
}

export function gridDegForRegion(region: "na" | "global"): number {
  return region === "na" ? NA_GRID_DEG : GLOBAL_GRID_DEG;
}

/** Adjacent grid cells (same step as gridDeg). */
export function neighborCellIds(cellId: string, gridDeg: number): string[] {
  const [latStr, lngStr] = cellId.split("_");
  const lat = Number.parseInt(latStr, 10);
  const lng = Number.parseInt(lngStr, 10);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return [];

  const ids: string[] = [];
  for (const dLat of [-gridDeg, 0, gridDeg]) {
    for (const dLng of [-gridDeg, 0, gridDeg]) {
      if (dLat === 0 && dLng === 0) continue;
      ids.push(`${lat + dLat}_${lng + dLng}`);
    }
  }
  return ids;
}
