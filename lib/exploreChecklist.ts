import checklistData from "@/data/regional-priors/ecozone-checklist.json";
import { gridDegForRegion } from "@/lib/cellId";
import { normalizeScientificName } from "@/lib/taxonomy";
import {
  CHECKLIST_ALL_MONTH_PRIOR,
  CHECKLIST_MONTH_PRIOR,
  type ChecklistContext,
  ecozoneForCoords,
} from "@/lib/speciesChecklist";

/** Months on the ecozone month-specific list → year-round resident. */
export const EXPLORE_RESIDENT_MONTH_THRESHOLD = 10;

/** Explore charts use a fixed abundance scale (Merlin-style relative bars). */
export const EXPLORE_CHART_ABSOLUTE_MAX = 0.2;

export const EXPLORE_MIN_LIST_FREQ = 0.001;

interface ChecklistZone {
  label?: string;
  months: Record<string, string[] | Record<string, number>>;
}

interface ChecklistBundle {
  version: number;
  zones: Record<string, ChecklistZone>;
}

const checklist = checklistData as ChecklistBundle;

function zoneForCoords(lat: number, lng: number): ChecklistZone | null {
  const zoneId = ecozoneForCoords(lat, lng);
  if (!zoneId) return null;
  return checklist.zones[zoneId] ?? null;
}

function monthSpeciesList(zone: ChecklistZone, month: number): string[] {
  const raw = zone.months[String(month)];
  if (!raw || Array.isArray(raw)) return (raw as string[] | undefined) ?? [];
  return Object.keys(raw);
}

function monthFreqMap(zone: ChecklistZone, month: number): Record<string, number> {
  const raw = zone.months[`${month}_freq`];
  if (raw && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }
  return {};
}

function allFreqMap(zone: ChecklistZone): Record<string, number> {
  const raw = zone.months.all_freq;
  if (raw && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }
  return {};
}

function allSpeciesList(zone: ChecklistZone): string[] {
  const raw = zone.months.all;
  if (!raw || Array.isArray(raw)) return (raw as string[] | undefined) ?? [];
  return Object.keys(raw);
}

export function countSpecificChecklistMonths(
  zone: ChecklistZone,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;

  let count = 0;
  for (let month = 1; month <= 12; month++) {
    if (isOnMonthSpecificList(zone, month, key)) {
      count++;
    }
  }
  return count;
}

function isOnMonthSpecificList(
  zone: ChecklistZone,
  month: number,
  scientificName: string,
): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;
  for (const species of monthSpeciesList(zone, month)) {
    if (normalizeScientificName(species) === key) return true;
  }
  return false;
}

function isOnAllYearList(zone: ChecklistZone, scientificName: string): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;
  for (const species of allSpeciesList(zone)) {
    if (normalizeScientificName(species) === key) return true;
  }
  return false;
}

/**
 * Explore-only checklist membership with migrant vs resident handling.
 * Migrants (e.g. Canada Goose) only appear in months they're on the specific list.
 */
export function isOnExploreChecklist(
  ctx: ChecklistContext,
  scientificName: string,
): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;

  const zone = zoneForCoords(ctx.lat, ctx.lng);
  if (!zone) return false;

  if (isOnMonthSpecificList(zone, ctx.month, key)) return true;

  if (!isOnAllYearList(zone, key)) return false;

  const specificMonths = countSpecificChecklistMonths(zone, key);
  if (specificMonths === 0) return true;
  if (specificMonths >= EXPLORE_RESIDENT_MONTH_THRESHOLD) return true;

  return false;
}

/**
 * Explore-only seasonal prior using per-month frequencies when available.
 * Does not affect Sound/Photo ID (those use checklistPrior).
 */
export function exploreChecklistPrior(
  ctx: ChecklistContext,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;

  const zone = zoneForCoords(ctx.lat, ctx.lng);
  if (!zone) return 0;

  const monthFreq = monthFreqMap(zone, ctx.month)[key];
  if (monthFreq != null && monthFreq > 0) return monthFreq;

  if (isOnMonthSpecificList(zone, ctx.month, key)) {
    return CHECKLIST_MONTH_PRIOR;
  }

  if (!isOnAllYearList(zone, key)) return 0;

  const specificMonths = countSpecificChecklistMonths(zone, key);
  if (specificMonths === 0) {
    return allFreqMap(zone)[key] ?? CHECKLIST_ALL_MONTH_PRIOR;
  }
  if (specificMonths >= EXPLORE_RESIDENT_MONTH_THRESHOLD) {
    return allFreqMap(zone)[key] ?? CHECKLIST_ALL_MONTH_PRIOR;
  }

  return 0;
}

/** Candidate species for Explore — month checklist + residents, not off-season migrants. */
export function exploreSpeciesCandidates(
  lat: number,
  lng: number,
  month: number,
): string[] {
  const zone = zoneForCoords(lat, lng);
  if (!zone) return [];

  const ctx: ChecklistContext = { lat, lng, month };
  const candidates = new Set<string>();

  for (const species of monthSpeciesList(zone, month)) {
    const key = normalizeScientificName(species);
    if (key) candidates.add(key);
  }

  for (const species of allSpeciesList(zone)) {
    const key = normalizeScientificName(species);
    if (!key) continue;
    if (isOnExploreChecklist(ctx, key)) {
      candidates.add(key);
    }
  }

  return [...candidates];
}

export function cellCenterFromId(cellId: string, gridDeg: number): { lat: number; lng: number } {
  const [latStr, lngStr] = cellId.split("_");
  const latBand = Number.parseInt(latStr, 10);
  const lngBand = Number.parseInt(lngStr, 10);
  return {
    lat: latBand + gridDeg / 2,
    lng: lngBand + gridDeg / 2,
  };
}

/** Inverse-distance weight for neighbor cell (Explore strict GBIF only). */
export function neighborDistanceWeight(
  lat: number,
  lng: number,
  cellId: string,
  bundleRegion: "na" | "global",
): number {
  const gridDeg = gridDegForRegion(bundleRegion);
  const center = cellCenterFromId(cellId, gridDeg);
  const dLat = lat - center.lat;
  const dLng = lng - center.lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const maxDist = gridDeg * Math.SQRT2 * 1.5;
  return Math.max(0.15, 1 - dist / maxDist);
}
