import { observedDate } from "@/lib/sightingFormat";
import { rarityForSighting } from "@/lib/rarity";
import type { Rarity, Sighting } from "@/types";

export type JournalRarityFilter = Rarity | "all";

export type JournalSort =
  | "newest"
  | "oldest"
  | "rarest"
  | "most_common"
  | "species_az"
  | "species_za";

export interface JournalFilters {
  rarity: JournalRarityFilter;
  sort: JournalSort;
}

export const DEFAULT_JOURNAL_FILTERS: JournalFilters = {
  rarity: "all",
  sort: "newest",
};

const RARITY_RANK: Record<Rarity, number> = {
  rare: 3,
  uncommon: 2,
  common: 1,
};

export function countActiveJournalFilters(filters: JournalFilters): number {
  let count = 0;
  if (filters.rarity !== "all") count += 1;
  if (filters.sort !== "newest") count += 1;
  return count;
}

export function journalCardClassName(rarity: Rarity): string {
  switch (rarity) {
    case "rare":
      return "rounded-2xl border border-purple-800/45 bg-purple-950/55";
    case "uncommon":
      return "rounded-2xl border border-amber-700/45 bg-amber-950/50";
    default:
      return "rounded-2xl bg-card";
  }
}

export function shouldGroupJournalByDate(sort: JournalSort): boolean {
  return sort === "newest" || sort === "oldest";
}

export function sortJournalSightings(
  sightings: Sighting[],
  sort: JournalSort,
): Sighting[] {
  const copy = [...sightings];

  switch (sort) {
    case "oldest":
      return copy.sort(
        (a, b) => observedDate(a).getTime() - observedDate(b).getTime(),
      );
    case "rarest":
      return copy.sort((a, b) => {
        const rarityDiff =
          RARITY_RANK[rarityForSighting(b)] - RARITY_RANK[rarityForSighting(a)];
        if (rarityDiff !== 0) return rarityDiff;
        return observedDate(b).getTime() - observedDate(a).getTime();
      });
    case "most_common":
      return copy.sort((a, b) => {
        const rarityDiff =
          RARITY_RANK[rarityForSighting(a)] - RARITY_RANK[rarityForSighting(b)];
        if (rarityDiff !== 0) return rarityDiff;
        return observedDate(b).getTime() - observedDate(a).getTime();
      });
    case "species_az":
      return copy.sort((a, b) =>
        a.species.localeCompare(b.species, undefined, { sensitivity: "base" }),
      );
    case "species_za":
      return copy.sort((a, b) =>
        b.species.localeCompare(a.species, undefined, { sensitivity: "base" }),
      );
    case "newest":
    default:
      return copy.sort(
        (a, b) => observedDate(b).getTime() - observedDate(a).getTime(),
      );
  }
}

export function applyJournalFilters(
  sightings: Sighting[],
  filters: JournalFilters,
): Sighting[] {
  const filtered =
    filters.rarity === "all"
      ? sightings
      : sightings.filter((s) => rarityForSighting(s) === filters.rarity);

  return sortJournalSightings(filtered, filters.sort);
}
