import type { ProfileBadge } from "@/lib/profileBadges";

export const PROFILE_SHOWCASE_BADGE_SLOTS = 3;

export type ShowcaseBadgeSlot = ProfileBadge | null;

export function normalizeShowcaseBadgeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, PROFILE_SHOWCASE_BADGE_SLOTS);
}

export function resolveShowcaseBadges(
  badges: ProfileBadge[],
  showcaseIds: string[] | null | undefined,
): ShowcaseBadgeSlot[] {
  const earnedById = new Map(
    badges.filter((badge) => badge.earned).map((badge) => [badge.id, badge]),
  );
  const ids = normalizeShowcaseBadgeIds(showcaseIds ?? []);

  return Array.from({ length: PROFILE_SHOWCASE_BADGE_SLOTS }, (_, index) => {
    const id = ids[index];
    if (!id) return null;
    return earnedById.get(id) ?? null;
  });
}

export function sanitizeShowcaseBadgeIds(
  ids: string[],
  earnedBadgeIds: Set<string>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (!earnedBadgeIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= PROFILE_SHOWCASE_BADGE_SLOTS) break;
  }

  return result;
}
