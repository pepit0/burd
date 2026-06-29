import ecozones from "@/data/ecozones.json";
import checklistData from "@/data/regional-priors/ecozone-checklist.json";
import { normalizeScientificName } from "@/lib/taxonomy";

/** Synthetic prior when species is on ecozone checklist but GBIF cell is empty. */
export const CHECKLIST_MONTH_PRIOR = 0.05;
export const CHECKLIST_ALL_MONTH_PRIOR = 0.02;

export interface ChecklistContext {
  lat: number;
  lng: number;
  month: number;
}

interface EcozoneDef {
  id: string;
  label: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface ChecklistZone {
  label?: string;
  months: Record<string, string[]>;
}

interface ChecklistBundle {
  version: number;
  zones: Record<string, ChecklistZone>;
}

const zones = (ecozones as { zones: EcozoneDef[] }).zones;
const checklist = checklistData as ChecklistBundle;

const monthListCache = new Map<string, Set<string>>();

function zoneCacheKey(zoneId: string, month: number): string {
  return `${zoneId}:${month}`;
}

function monthSpeciesSet(zoneId: string, month: number): Set<string> {
  const key = zoneCacheKey(zoneId, month);
  const cached = monthListCache.get(key);
  if (cached) return cached;

  const zone = checklist.zones[zoneId];
  const set = new Set<string>();
  if (!zone) {
    monthListCache.set(key, set);
    return set;
  }

  for (const species of zone.months[String(month)] ?? []) {
    set.add(normalizeScientificName(species));
  }
  for (const species of zone.months.all ?? []) {
    set.add(normalizeScientificName(species));
  }

  monthListCache.set(key, set);
  return set;
}

/** Best-matching ecozone for coordinates (most specific overlap wins by area). */
export function ecozoneForCoords(lat: number, lng: number): string | null {
  let best: { id: string; area: number } | null = null;

  for (const zone of zones) {
    if (
      lat < zone.minLat ||
      lat > zone.maxLat ||
      lng < zone.minLng ||
      lng > zone.maxLng
    ) {
      continue;
    }
    const area =
      (zone.maxLat - zone.minLat) * (zone.maxLng - zone.minLng);
    if (!best || area < best.area) {
      best = { id: zone.id, area };
    }
  }

  return best?.id ?? null;
}

/** Merlin-style checklist prior when GBIF cell data is sparse or missing. */
export function checklistPrior(
  ctx: ChecklistContext,
  scientificName: string,
): number {
  const key = normalizeScientificName(scientificName);
  if (!key) return 0;

  const zoneId = ecozoneForCoords(ctx.lat, ctx.lng);
  if (!zoneId) return 0;

  const zone = checklist.zones[zoneId];
  if (!zone) return 0;

  const monthList = zone.months[String(ctx.month)] ?? [];
  if (monthList.some((s) => normalizeScientificName(s) === key)) {
    return CHECKLIST_MONTH_PRIOR;
  }

  const allList = zone.months.all ?? [];
  if (allList.some((s) => normalizeScientificName(s) === key)) {
    return CHECKLIST_ALL_MONTH_PRIOR;
  }

  return 0;
}

export function isOnRegionalChecklist(
  ctx: ChecklistContext,
  scientificName: string,
): boolean {
  const key = normalizeScientificName(scientificName);
  if (!key) return false;

  const zoneId = ecozoneForCoords(ctx.lat, ctx.lng);
  if (!zoneId) return false;

  return monthSpeciesSet(zoneId, ctx.month).has(key);
}

export function getChecklistZoneLabel(lat: number, lng: number): string | null {
  const zoneId = ecozoneForCoords(lat, lng);
  if (!zoneId) return null;
  return checklist.zones[zoneId]?.label ?? zoneId;
}

export function hasChecklistData(lat: number, lng: number): boolean {
  const zoneId = ecozoneForCoords(lat, lng);
  if (!zoneId) return false;
  const zone = checklist.zones[zoneId];
  return Boolean(zone?.months?.all?.length);
}

/** All checklist species for this ecozone (month list + all-year union). */
export function checklistSpeciesForCoords(
  lat: number,
  lng: number,
  month: number,
): string[] {
  const zoneId = ecozoneForCoords(lat, lng);
  if (!zoneId) return [];
  return [...monthSpeciesSet(zoneId, month)];
}
