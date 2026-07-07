import {
  EXPLORE_MIN_LIST_FREQ,
  exploreSpeciesCandidates,
  isOnExploreChecklist,
} from "@/lib/exploreChecklist";
import {
  collectRegionalSpeciesCandidates,
  getRegionalContext,
  getSpeciesMonthlyAbundance,
  lookupSpeciesScoreStrict,
  type MonthlyAbundance,
} from "@/lib/regionalFrequency";
import { getCatalogSpeciesByScientificName } from "@/lib/speciesCatalog";

export type { MonthlyAbundance };

export interface LikelySpeciesEntry {
  id: string;
  species: string;
  scientific_name: string;
  frequency: number;
  monthly: MonthlyAbundance[];
}

function exploreCandidateKeys(
  lat: number,
  lng: number,
  date: Date,
): string[] {
  const ctx = getRegionalContext(lat, lng, date);
  const fromChecklist = exploreSpeciesCandidates(lat, lng, ctx.month);
  const fromGbif = collectRegionalSpeciesCandidates(lat, lng, date);
  return [...new Set([...fromChecklist, ...fromGbif])];
}

export function listLikelySpeciesNearLocation(
  lat: number,
  lng: number,
  options?: { date?: Date },
): LikelySpeciesEntry[] {
  const date = options?.date ?? new Date();
  const ctx = getRegionalContext(lat, lng, date);
  const checklistCtx = { lat, lng, month: ctx.month };
  const candidates = exploreCandidateKeys(lat, lng, date);

  const rows: LikelySpeciesEntry[] = [];
  for (const scientificName of candidates) {
    if (!isOnExploreChecklist(checklistCtx, scientificName)) continue;

    const catalog = getCatalogSpeciesByScientificName(scientificName);
    if (!catalog) continue;

    const score = lookupSpeciesScoreStrict(ctx, scientificName);
    if (score.frequency < EXPLORE_MIN_LIST_FREQ) continue;

    rows.push({
      id: catalog.id,
      species: catalog.species,
      scientific_name: catalog.scientific_name,
      frequency: score.frequency,
      monthly: getSpeciesMonthlyAbundance(
        lat,
        lng,
        catalog.scientific_name,
        date.getFullYear(),
      ),
    });
  }

  rows.sort((a, b) => b.frequency - a.frequency);
  return rows;
}

export function abundanceHeadline(frequency: number, expected: boolean): string {
  if (!expected || frequency <= 0) return "Not expected";
  if (frequency >= 0.08) return "Likely";
  if (frequency >= 0.02) return "Possible";
  return "Uncommon";
}
