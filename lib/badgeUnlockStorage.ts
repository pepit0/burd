import AsyncStorage from "@react-native-async-storage/async-storage";

function storageKey(userId: string) {
  return `burd:celebrated-badge-ids:${userId}`;
}

export async function loadCelebratedBadgeIds(userId: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function saveCelebratedBadgeIds(
  userId: string,
  badgeIds: string[],
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(badgeIds));
}

/** First run: mark current earned badges as already celebrated (no retroactive pop-ups). */
export async function initializeCelebratedBadges(
  userId: string,
  earnedBadgeIds: string[],
): Promise<string[]> {
  const existing = await loadCelebratedBadgeIds(userId);
  if (existing !== null) {
    return earnedBadgeIds.filter((id) => !existing.includes(id));
  }
  await saveCelebratedBadgeIds(userId, earnedBadgeIds);
  return [];
}

export async function markBadgeCelebrated(
  userId: string,
  badgeId: string,
): Promise<void> {
  const existing = (await loadCelebratedBadgeIds(userId)) ?? [];
  if (existing.includes(badgeId)) return;
  await saveCelebratedBadgeIds(userId, [...existing, badgeId]);
}
