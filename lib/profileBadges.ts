import { buildSightingIndex, countLoggedInCatalog } from "@/lib/fieldGuide";
import { rarityForSighting } from "@/lib/rarity";
import { SPECIES_CATALOG } from "@/lib/speciesCatalog";
import { supabase } from "@/lib/supabase";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import type { Sighting } from "@/types";

export type BadgeFamily =
  | "life_list"
  | "capture"
  | "sound"
  | "rarity"
  | "community"
  | "explorer"
  | "dedication";

export interface ProfileBadge {
  id: string;
  label: string;
  desc: string;
  family: BadgeFamily;
  earned: boolean;
  /** Estimated unlock time from sighting history (community badges may omit). */
  earnedAt?: string | null;
}

export const BADGE_FAMILY_ORDER: BadgeFamily[] = [
  "life_list",
  "capture",
  "sound",
  "rarity",
  "community",
  "explorer",
  "dedication",
];

export const BADGE_FAMILY_LABELS: Record<BadgeFamily, string> = {
  life_list: "Life list",
  capture: "Capture",
  sound: "Sound",
  rarity: "Rarity",
  community: "Community",
  explorer: "Explorer",
  dedication: "Dedication",
};

export interface ProfileBadgeExtras {
  commentsLeft: number;
  likesReceived: number;
  repostsGiven: number;
  fieldGuideAuthorCredits: number;
}

export interface ProfileBadgeInput {
  sightings: Sighting[];
  friends: number;
  extras?: ProfileBadgeExtras;
}

interface SightingMetrics {
  total: number;
  published: number;
  speciesCount: number;
  catalogLogged: number;
  catalogTotal: number;
  photoCount: number;
  audioCount: number;
  photoPosts: number;
  notesCount: number;
  commonCount: number;
  uncommonCount: number;
  rareCount: number;
  aiIdCount: number;
  livePhotoProxy: number;
  liveSoundProxy: number;
  manualCount: number;
  bothIdCount: number;
  maxPhotosOnSighting: number;
  cityCount: number;
  uniquePatchCount: number;
  gpsCount: number;
  maxPatchCount: number;
  uniqueDays: number;
  maxDayCount: number;
  longestStreak: number;
  weeksInMonthMax: number;
  uniqueMonths: number;
  seasonsLogged: number;
  before7am: number;
  before8am: number;
  after8pm: number;
  twilightCount: number;
}

const EMPTY_EXTRAS: ProfileBadgeExtras = {
  commentsLeft: 0,
  likesReceived: 0,
  repostsGiven: 0,
  fieldGuideAuthorCredits: 0,
};

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekOfMonthKey(date: Date): string {
  const week = Math.ceil(date.getDate() / 7);
  return `${monthKey(date)}-w${week}`;
}

function seasonForMonth(month: number): "spring" | "summer" | "fall" | "winter" {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function patchKey(sighting: Sighting): string | null {
  const place = sighting.location_name?.trim() || sighting.location_city?.trim();
  return place ? place.toLowerCase() : null;
}

function when(sighting: Sighting): Date {
  return new Date(sighting.observed_at ?? sighting.created_at);
}

function computeLongestStreak(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0;

  const sorted = [...new Set(dayKeys)].sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = new Date(`${sorted[index - 1]}T12:00:00`);
    const next = new Date(`${sorted[index]}T12:00:00`);
    const diffDays = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function markDate(dates: Record<string, string | null>, id: string, date: Date) {
  if (!dates[id]) {
    dates[id] = date.toISOString();
  }
}

function computeBadgeEarnedDates(sightings: Sighting[]): Record<string, string | null> {
  const dates: Record<string, string | null> = {};
  const sorted = [...sightings].sort((a, b) => when(a).getTime() - when(b).getTime());
  const accumulated: Sighting[] = [];
  const species = new Set<string>();
  const cities = new Set<string>();
  const months = new Set<string>();
  const seasons = new Set<string>();
  const dayKeys: string[] = [];
  const weeksByMonth = new Map<string, Set<string>>();
  const patches = new Map<string, number>();

  let photoCount = 0;
  let audioCount = 0;
  let published = 0;
  let photoPosts = 0;
  let notesCount = 0;
  let uncommonCount = 0;
  let rareCount = 0;
  let commonCount = 0;
  let manualCount = 0;
  let bothIdCount = 0;
  let aiIdCount = 0;
  let gpsCount = 0;
  let twilightCount = 0;
  let maxPhotosOnSighting = 0;
  let before7am = 0;
  let before8am = 0;
  let after8pm = 0;
  let hasCommon = false;
  let hasUncommon = false;
  let hasRare = false;
  let firstCommonAt: Date | null = null;
  let firstUncommonAt: Date | null = null;
  let firstRareAt: Date | null = null;

  for (const sighting of sorted) {
    accumulated.push(sighting);
    const at = when(sighting);
    const total = accumulated.length;

    if (total === 1) markDate(dates, "first_flight", at);
    if (total === 5) markDate(dates, "getting_started", at);
    if (total === 10) markDate(dates, "prolific_birder", at);
    if (total === 25) markDate(dates, "dedicated_lister", at);
    if (total === 50) markDate(dates, "seasoned_birder", at);
    if (total === 100) markDate(dates, "century_club", at);
    if (total === 250) markDate(dates, "avian_marathon", at);

    species.add(sighting.species.trim().toLowerCase());
    const speciesCount = species.size;
    if (speciesCount === 10) markDate(dates, "life_list_builder", at);
    if (speciesCount === 25) markDate(dates, "growing_list", at);
    if (speciesCount === 50) markDate(dates, "half_century", at);
    if (speciesCount === 100) markDate(dates, "century_species", at);
    if (speciesCount === 150) markDate(dates, "species_scholar", at);

    const catalogLogged = countLoggedInCatalog(
      SPECIES_CATALOG,
      buildSightingIndex(accumulated),
    );
    const catalogPct = catalogLogged / SPECIES_CATALOG.length;
    if (catalogPct >= 0.1) markDate(dates, "field_guide_tenth", at);
    if (catalogPct >= 0.25) markDate(dates, "field_guide_quarter", at);
    if (catalogPct >= 0.5) markDate(dates, "field_guide_half", at);
    if (catalogPct >= 0.75) markDate(dates, "field_guide_three_quarters", at);
    if (catalogPct >= 1) markDate(dates, "catalog_completer", at);

    if (isPhotoSighting(sighting)) {
      photoCount += 1;
      if (photoCount === 1) markDate(dates, "shutterbug", at);
      if (photoCount === 5) markDate(dates, "multi_snap", at);
      if (photoCount === 25) markDate(dates, "gallery_birder", at);
      if (photoCount === 50) markDate(dates, "portrait_pro", at);
      if (photoCount === 100) markDate(dates, "shutter_legend", at);
    }

    const photoCountOnSighting =
      sighting.photo_count ??
      (sighting.photos?.length ? sighting.photos.length : sighting.photo_url ? 1 : 0);
    maxPhotosOnSighting = Math.max(maxPhotosOnSighting, photoCountOnSighting);
    if (photoCountOnSighting >= 3) markDate(dates, "album_keeper", at);

    if (sighting.published_at) {
      published += 1;
      if (published === 1) markDate(dates, "first_post", at);
      if (published === 10) markDate(dates, "regular_poster", at);
      if (published === 25) markDate(dates, "prolific_publisher", at);
    }

    if (sighting.notes?.trim()) {
      notesCount += 1;
      if (notesCount === 10) markDate(dates, "storyteller", at);
    }

    if (sighting.published_at && isPhotoSighting(sighting)) {
      photoPosts += 1;
      if (photoPosts === 10) markDate(dates, "photo_publisher", at);
    }

    if (sighting.detected_by === "image" || sighting.detected_by === "both") {
      markDate(dates, "live_look", at);
    }
    if (sighting.detected_by === "both") {
      bothIdCount += 1;
      if (bothIdCount === 1) markDate(dates, "dual_sense", at);
    }
    if (sighting.detected_by === "manual") {
      manualCount += 1;
      if (manualCount === 10) markDate(dates, "field_notes", at);
    }
    if (sighting.detected_by !== "manual") {
      aiIdCount += 1;
      if (aiIdCount === 25) markDate(dates, "ai_naturalist", at);
    }

    if (isAudioSighting(sighting)) {
      audioCount += 1;
      if (audioCount === 1) markDate(dates, "sound_scout", at);
      if (audioCount === 5) markDate(dates, "ear_to_sky", at);
      if (audioCount === 15) markDate(dates, "sound_archive", at);
      if (audioCount === 25) markDate(dates, "sound_collector", at);
      if (audioCount === 50) markDate(dates, "acoustic_legend", at);
    }

    if (sighting.detected_by === "audio" || sighting.detected_by === "both") {
      markDate(dates, "live_listener", at);
    }

    const hour = at.getHours();
    if (hour < 7) {
      before7am += 1;
      if (before7am === 1) markDate(dates, "dawn_chorus", at);
    }
    if (hour < 8) {
      before8am += 1;
      if (before8am === 10) markDate(dates, "early_riser", at);
      if (before8am === 25) markDate(dates, "sunrise_regular", at);
    }
    if (hour >= 17 && hour < 19) {
      twilightCount += 1;
      if (twilightCount === 1) markDate(dates, "twilight_chorus", at);
    }
    if (hour >= 20) {
      after8pm += 1;
      if (after8pm === 1) markDate(dates, "night_listener", at);
      if (after8pm === 10) markDate(dates, "night_owl", at);
    }

    const rarity = rarityForSighting(sighting);
    if (rarity === "common") {
      commonCount += 1;
      if (!hasCommon) {
        hasCommon = true;
        firstCommonAt = at;
      }
      if (commonCount === 10) markDate(dates, "common_ground", at);
    }
    if (rarity === "uncommon") {
      uncommonCount += 1;
      if (!hasUncommon) {
        hasUncommon = true;
        firstUncommonAt = at;
      }
      if (uncommonCount === 5) markDate(dates, "uncommon_eye", at);
    }
    if (rarity === "rare") {
      rareCount += 1;
      if (!hasRare) {
        hasRare = true;
        firstRareAt = at;
        markDate(dates, "rare_find", at);
      }
      if (rareCount === 5) markDate(dates, "treasure_hunter", at);
      if (rareCount === 10) markDate(dates, "jackpot", at);
      if (rareCount === 15) markDate(dates, "rarity_collector", at);
    }

    if (sighting.latitude != null && sighting.longitude != null) {
      gpsCount += 1;
      if (gpsCount === 10) markDate(dates, "on_the_map", at);
    }

    const city = sighting.location_city?.trim();
    if (city) {
      cities.add(city.toLowerCase());
      if (cities.size === 3) markDate(dates, "new_horizons", at);
      if (cities.size === 8) markDate(dates, "traveler", at);
      if (cities.size === 15) markDate(dates, "globetrotter", at);
    }

    const patch = patchKey(sighting);
    if (patch) {
      const patchCount = (patches.get(patch) ?? 0) + 1;
      patches.set(patch, patchCount);
      if (patchCount === 10) markDate(dates, "patch_regular", at);
      if (patchCount === 25) markDate(dates, "patch_master", at);
    }
    if (patches.size === 5) markDate(dates, "local_explorer", at);

    const dk = dayKey(at);
    dayKeys.push(dk);
    const uniqueDayCount = new Set(dayKeys).size;
    if (uniqueDayCount === 5) markDate(dates, "weekend_warrior", at);
    if (uniqueDayCount === 30) markDate(dates, "consistent_birder", at);
    const streak = computeLongestStreak(dayKeys);
    if (streak >= 7) markDate(dates, "weekly_rhythm", at);
    if (streak >= 14) markDate(dates, "fortnight_streak", at);
    if (streak >= 30) markDate(dates, "thirty_day_streak", at);

    const dayCount = dayKeys.filter((key) => key === dk).length;
    if (dayCount === 3) markDate(dates, "big_day", at);
    if (dayCount === 5) markDate(dates, "mega_day", at);

    months.add(monthKey(at));
    if (months.size === 12) markDate(dates, "year_round_birder", at);

    const season = seasonForMonth(at.getMonth());
    seasons.add(season);
    if (seasons.size === 4) markDate(dates, "four_seasons", at);

    const mk = monthKey(at);
    const wk = weekOfMonthKey(at);
    const monthWeeks = weeksByMonth.get(mk) ?? new Set<string>();
    monthWeeks.add(wk);
    weeksByMonth.set(mk, monthWeeks);
    if (monthWeeks.size === 4) markDate(dates, "month_of_birding", at);
  }

  if (hasCommon && hasUncommon && hasRare && firstCommonAt && firstUncommonAt && firstRareAt) {
    const fullSpectrumAt = new Date(
      Math.max(firstCommonAt.getTime(), firstUncommonAt.getTime(), firstRareAt.getTime()),
    );
    markDate(dates, "full_spectrum", fullSpectrumAt);
  }

  return dates;
}

export function getRecentEarnedBadges(badges: ProfileBadge[], limit = 5): ProfileBadge[] {
  return badges
    .filter((badge) => badge.earned)
    .sort((a, b) => {
      const aTime = a.earnedAt ? new Date(a.earnedAt).getTime() : 0;
      const bTime = b.earnedAt ? new Date(b.earnedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

function computeMetrics(sightings: Sighting[]): SightingMetrics {
  const species = new Set<string>();
  const cities = new Set<string>();
  const days = new Map<string, number>();
  const patches = new Map<string, number>();
  const months = new Set<string>();
  const seasons = new Set<string>();
  const weeksByMonth = new Map<string, Set<string>>();

  let published = 0;
  let photoCount = 0;
  let audioCount = 0;
  let photoPosts = 0;
  let notesCount = 0;
  let commonCount = 0;
  let uncommonCount = 0;
  let rareCount = 0;
  let aiIdCount = 0;
  let livePhotoProxy = 0;
  let liveSoundProxy = 0;
  let manualCount = 0;
  let bothIdCount = 0;
  let maxPhotosOnSighting = 0;
  let before7am = 0;
  let before8am = 0;
  let after8pm = 0;
  let twilightCount = 0;
  let gpsCount = 0;

  for (const sighting of sightings) {
    species.add(sighting.species.trim().toLowerCase());
    if (sighting.published_at) published += 1;
    if (isPhotoSighting(sighting)) photoCount += 1;
    if (isAudioSighting(sighting)) audioCount += 1;
    if (sighting.published_at && isPhotoSighting(sighting)) photoPosts += 1;
    if (sighting.notes?.trim()) notesCount += 1;

    const photoCountOnSighting =
      sighting.photo_count ??
      (sighting.photos?.length ? sighting.photos.length : sighting.photo_url ? 1 : 0);
    maxPhotosOnSighting = Math.max(maxPhotosOnSighting, photoCountOnSighting);

    const rarity = rarityForSighting(sighting);
    if (rarity === "common") commonCount += 1;
    if (rarity === "uncommon") uncommonCount += 1;
    if (rarity === "rare") rareCount += 1;

    if (sighting.detected_by === "image" || sighting.detected_by === "both") {
      livePhotoProxy += 1;
    }
    if (sighting.detected_by === "audio" || sighting.detected_by === "both") {
      liveSoundProxy += 1;
    }
    if (sighting.detected_by === "both") bothIdCount += 1;
    if (sighting.detected_by === "manual") manualCount += 1;
    if (sighting.detected_by !== "manual") aiIdCount += 1;

    if (sighting.latitude != null && sighting.longitude != null) gpsCount += 1;

    const city = sighting.location_city?.trim();
    if (city) cities.add(city.toLowerCase());

    const patch = patchKey(sighting);
    if (patch) patches.set(patch, (patches.get(patch) ?? 0) + 1);

    const date = when(sighting);
    const dk = dayKey(date);
    days.set(dk, (days.get(dk) ?? 0) + 1);

    const mk = monthKey(date);
    months.add(mk);
    seasons.add(seasonForMonth(date.getMonth()));

    const wk = weekOfMonthKey(date);
    const monthWeeks = weeksByMonth.get(mk) ?? new Set<string>();
    monthWeeks.add(wk);
    weeksByMonth.set(mk, monthWeeks);

    const hour = date.getHours();
    if (hour < 7) before7am += 1;
    if (hour < 8) before8am += 1;
    if (hour >= 17 && hour < 19) twilightCount += 1;
    if (hour >= 20) after8pm += 1;
  }

  const catalogIndex = buildSightingIndex(sightings);
  const catalogLogged = countLoggedInCatalog(SPECIES_CATALOG, catalogIndex);
  let weeksInMonthMax = 0;
  for (const weekSet of weeksByMonth.values()) {
    weeksInMonthMax = Math.max(weeksInMonthMax, weekSet.size);
  }

  let maxPatchCount = 0;
  for (const count of patches.values()) {
    maxPatchCount = Math.max(maxPatchCount, count);
  }

  let maxDayCount = 0;
  for (const count of days.values()) {
    maxDayCount = Math.max(maxDayCount, count);
  }

  return {
    total: sightings.length,
    published,
    speciesCount: species.size,
    catalogLogged,
    catalogTotal: SPECIES_CATALOG.length,
    photoCount,
    audioCount,
    photoPosts,
    notesCount,
    commonCount,
    uncommonCount,
    rareCount,
    aiIdCount,
    livePhotoProxy,
    liveSoundProxy,
    manualCount,
    bothIdCount,
    maxPhotosOnSighting,
    cityCount: cities.size,
    uniquePatchCount: patches.size,
    gpsCount,
    maxPatchCount,
    uniqueDays: days.size,
    maxDayCount,
    longestStreak: computeLongestStreak([...days.keys()]),
    weeksInMonthMax,
    uniqueMonths: months.size,
    seasonsLogged: seasons.size,
    before7am,
    before8am,
    after8pm,
    twilightCount,
  };
}

export async function fetchProfileBadgeExtras(userId: string): Promise<ProfileBadgeExtras> {
  const [commentsRes, repostsRes, authorRes, sightingsRes] = await Promise.all([
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("reposts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("species_profiles")
      .select("*", { count: "exact", head: true })
      .eq("author_user_id", userId),
    supabase.from("sightings").select("id").eq("user_id", userId).not("published_at", "is", null),
  ]);

  if (commentsRes.error) throw commentsRes.error;
  if (repostsRes.error) throw repostsRes.error;
  if (authorRes.error) throw authorRes.error;
  if (sightingsRes.error) throw sightingsRes.error;

  const sightingIds = (sightingsRes.data ?? []).map((row) => row.id as string);
  let likesReceived = 0;
  if (sightingIds.length > 0) {
    const likesRes = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .in("sighting_id", sightingIds);
    if (likesRes.error) throw likesRes.error;
    likesReceived = likesRes.count ?? 0;
  }

  return {
    commentsLeft: commentsRes.count ?? 0,
    repostsGiven: repostsRes.count ?? 0,
    fieldGuideAuthorCredits: authorRes.count ?? 0,
    likesReceived,
  };
}

export function buildProfileBadges(input: ProfileBadgeInput): ProfileBadge[] {
  const extras = input.extras ?? EMPTY_EXTRAS;
  const m = computeMetrics(input.sightings);
  const catalogPct = m.catalogTotal > 0 ? m.catalogLogged / m.catalogTotal : 0;

  const badges: Omit<ProfileBadge, "earned">[] = [
    { id: "first_flight", label: "First Flight", desc: "Logged your first sighting", family: "life_list" },
    { id: "getting_started", label: "Getting Started", desc: "Log 5 sightings", family: "life_list" },
    { id: "prolific_birder", label: "Prolific Birder", desc: "Log 10 sightings", family: "life_list" },
    { id: "dedicated_lister", label: "Dedicated Lister", desc: "Log 25 sightings", family: "life_list" },
    { id: "seasoned_birder", label: "Seasoned Birder", desc: "Log 50 sightings", family: "life_list" },
    { id: "century_club", label: "Century Club", desc: "Log 100 sightings", family: "life_list" },
    { id: "avian_marathon", label: "Avian Marathon", desc: "Log 250 sightings", family: "life_list" },
    {
      id: "life_list_builder",
      label: "Life List Builder",
      desc: "Log 10 unique species",
      family: "life_list",
    },
    { id: "growing_list", label: "Growing List", desc: "Log 25 unique species", family: "life_list" },
    { id: "half_century", label: "Half Century", desc: "Log 50 unique species", family: "life_list" },
    {
      id: "century_species",
      label: "Century Species",
      desc: "Log 100 unique species",
      family: "life_list",
    },
    {
      id: "species_scholar",
      label: "Species Scholar",
      desc: "Log 150 unique species",
      family: "life_list",
    },
    {
      id: "field_guide_tenth",
      label: "Field Guide Starter",
      desc: "Log 10% of the catalog",
      family: "life_list",
    },
    {
      id: "field_guide_quarter",
      label: "Field Guide Quarter",
      desc: "Log 25% of the catalog",
      family: "life_list",
    },
    {
      id: "field_guide_half",
      label: "Field Guide Half",
      desc: "Log 50% of the catalog",
      family: "life_list",
    },
    {
      id: "field_guide_three_quarters",
      label: "Field Guide Expert",
      desc: "Log 75% of the catalog",
      family: "life_list",
    },
    {
      id: "catalog_completer",
      label: "Catalog Completer",
      desc: "Log 100% of the catalog",
      family: "life_list",
    },

    { id: "shutterbug", label: "Shutterbug", desc: "Add a photo to a sighting", family: "capture" },
    { id: "first_post", label: "First Post", desc: "Share your first sighting to profile", family: "capture" },
    { id: "regular_poster", label: "Regular Poster", desc: "Publish 10 posts", family: "capture" },
    { id: "storyteller", label: "Storyteller", desc: "Add notes to 10 sightings", family: "capture" },
    { id: "multi_snap", label: "Multi-Snap", desc: "Log 5 photo sightings", family: "capture" },
    { id: "gallery_birder", label: "Gallery Birder", desc: "Log 25 photo sightings", family: "capture" },
    { id: "portrait_pro", label: "Portrait Pro", desc: "Log 50 photo sightings", family: "capture" },
    { id: "shutter_legend", label: "Shutter Legend", desc: "Log 100 photo sightings", family: "capture" },
    {
      id: "live_look",
      label: "Live Look",
      desc: "Identify a bird with live photo ID",
      family: "capture",
    },
    { id: "photo_publisher", label: "Photo Publisher", desc: "Publish 10 photo posts", family: "capture" },
    { id: "prolific_publisher", label: "Prolific Publisher", desc: "Publish 25 posts", family: "capture" },
    {
      id: "field_notes",
      label: "Field Notes",
      desc: "Log 10 manual sightings",
      family: "capture",
    },
    {
      id: "dual_sense",
      label: "Dual Sense",
      desc: "Identify with photo and sound together",
      family: "capture",
    },
    {
      id: "ai_naturalist",
      label: "AI Naturalist",
      desc: "Get 25 AI-assisted identifications",
      family: "capture",
    },
    {
      id: "album_keeper",
      label: "Album Keeper",
      desc: "Add 3+ photos to one sighting",
      family: "capture",
    },

    { id: "sound_scout", label: "Sound Scout", desc: "Log your first audio sighting", family: "sound" },
    { id: "ear_to_sky", label: "Ear to the Sky", desc: "Log 5 audio sightings", family: "sound" },
    { id: "sound_archive", label: "Sound Archive", desc: "Log 15 audio recordings", family: "sound" },
    { id: "sound_collector", label: "Sound Collector", desc: "Log 25 audio recordings", family: "sound" },
    { id: "acoustic_legend", label: "Acoustic Legend", desc: "Log 50 audio recordings", family: "sound" },
    {
      id: "live_listener",
      label: "Live Listener",
      desc: "Identify a bird with live sound ID",
      family: "sound",
    },
    { id: "dawn_chorus", label: "Dawn Chorus", desc: "Log a sighting before 7:00 AM", family: "sound" },
    {
      id: "twilight_chorus",
      label: "Twilight Chorus",
      desc: "Log a sighting between 5:00–7:00 PM",
      family: "sound",
    },
    { id: "night_listener", label: "Night Listener", desc: "Log a sighting after 8:00 PM", family: "sound" },

    { id: "rare_find", label: "Rare Find", desc: "Spot a rare bird", family: "rarity" },
    { id: "common_ground", label: "Common Ground", desc: "Log 10 common sightings", family: "rarity" },
    { id: "uncommon_eye", label: "Uncommon Eye", desc: "Log 5 uncommon sightings", family: "rarity" },
    { id: "treasure_hunter", label: "Treasure Hunter", desc: "Log 5 rare sightings", family: "rarity" },
    { id: "jackpot", label: "Jackpot", desc: "Log 10 rare sightings", family: "rarity" },
    { id: "rarity_collector", label: "Rarity Collector", desc: "Log 15 rare sightings", family: "rarity" },
    {
      id: "full_spectrum",
      label: "Full Spectrum",
      desc: "Log common, uncommon, and rare",
      family: "rarity",
    },

    { id: "social_flyer", label: "Social Flyer", desc: "Add another birder", family: "community" },
    { id: "friendly_flock", label: "Friendly Flock", desc: "Add 5 birder friends", family: "community" },
    { id: "community_nest", label: "Community Nest", desc: "Add 15 birder friends", family: "community" },
    { id: "flock_leader", label: "Flock Leader", desc: "Add 25 birder friends", family: "community" },
    { id: "first_cheer", label: "First Cheer", desc: "Receive your first like on a post", family: "community" },
    {
      id: "crowd_favorite",
      label: "Crowd Favorite",
      desc: "Earn 50 total likes on your posts",
      family: "community",
    },
    {
      id: "beloved_birder",
      label: "Beloved Birder",
      desc: "Earn 100 total likes on your posts",
      family: "community",
    },
    {
      id: "superfan",
      label: "Superfan",
      desc: "Earn 250 total likes on your posts",
      family: "community",
    },
    {
      id: "conversation_starter",
      label: "Conversation Starter",
      desc: "Leave 10 comments",
      family: "community",
    },
    { id: "community_voice", label: "Community Voice", desc: "Leave 25 comments", family: "community" },
    { id: "active_commenter", label: "Active Commenter", desc: "Leave 50 comments", family: "community" },
    { id: "amplifier", label: "Amplifier", desc: "Repost another birder's sighting", family: "community" },
    { id: "signal_booster", label: "Signal Booster", desc: "Repost 10 sightings", family: "community" },
    {
      id: "guide_author",
      label: "Guide Author",
      desc: "Earn field guide author credit",
      family: "community",
    },
    {
      id: "field_guide_writer",
      label: "Field Guide Writer",
      desc: "Earn 5 field guide author credits",
      family: "community",
    },

    { id: "new_horizons", label: "New Horizons", desc: "Log sightings in 3 different cities", family: "explorer" },
    { id: "traveler", label: "Traveler", desc: "Log sightings in 8 different cities", family: "explorer" },
    { id: "globetrotter", label: "Globetrotter", desc: "Log sightings in 15 different cities", family: "explorer" },
    {
      id: "patch_regular",
      label: "Patch Regular",
      desc: "Log 10 sightings at the same place",
      family: "explorer",
    },
    {
      id: "patch_master",
      label: "Patch Master",
      desc: "Log 25 sightings at the same place",
      family: "explorer",
    },
    {
      id: "local_explorer",
      label: "Local Explorer",
      desc: "Log at 5 different places",
      family: "explorer",
    },
    {
      id: "on_the_map",
      label: "On the Map",
      desc: "Log 10 sightings with GPS coordinates",
      family: "explorer",
    },
    {
      id: "four_seasons",
      label: "Four Seasons",
      desc: "Log in spring, summer, fall, and winter",
      family: "explorer",
    },
    {
      id: "year_round_birder",
      label: "Year-Round Birder",
      desc: "Log in 12 different months",
      family: "explorer",
    },
    { id: "big_day", label: "Big Day", desc: "Log 3 sightings in one day", family: "explorer" },
    { id: "mega_day", label: "Mega Day", desc: "Log 5 sightings in one day", family: "explorer" },

    { id: "weekend_warrior", label: "Weekend Warrior", desc: "Log on 5 different days", family: "dedication" },
    { id: "weekly_rhythm", label: "Weekly Rhythm", desc: "Log on 7 consecutive days", family: "dedication" },
    {
      id: "fortnight_streak",
      label: "Fortnight Streak",
      desc: "Log on 14 consecutive days",
      family: "dedication",
    },
    {
      id: "thirty_day_streak",
      label: "Thirty-Day Streak",
      desc: "Log on 30 consecutive days",
      family: "dedication",
    },
    {
      id: "consistent_birder",
      label: "Consistent Birder",
      desc: "Log on 30 different days",
      family: "dedication",
    },
    {
      id: "month_of_birding",
      label: "Month of Birding",
      desc: "Log in 4 different weeks of one month",
      family: "dedication",
    },
    { id: "early_riser", label: "Early Riser", desc: "Log 10 sightings before 8:00 AM", family: "dedication" },
    {
      id: "sunrise_regular",
      label: "Sunrise Regular",
      desc: "Log 25 sightings before 8:00 AM",
      family: "dedication",
    },
    { id: "night_owl", label: "Night Owl", desc: "Log 10 sightings after 8:00 PM", family: "dedication" },
  ];

  const earnedById: Record<string, boolean> = {
    first_flight: m.total >= 1,
    getting_started: m.total >= 5,
    prolific_birder: m.total >= 10,
    dedicated_lister: m.total >= 25,
    seasoned_birder: m.total >= 50,
    century_club: m.total >= 100,
    avian_marathon: m.total >= 250,
    life_list_builder: m.speciesCount >= 10,
    growing_list: m.speciesCount >= 25,
    half_century: m.speciesCount >= 50,
    century_species: m.speciesCount >= 100,
    species_scholar: m.speciesCount >= 150,
    field_guide_tenth: catalogPct >= 0.1,
    field_guide_quarter: catalogPct >= 0.25,
    field_guide_half: catalogPct >= 0.5,
    field_guide_three_quarters: catalogPct >= 0.75,
    catalog_completer: catalogPct >= 1,
    shutterbug: m.photoCount >= 1,
    first_post: m.published >= 1,
    regular_poster: m.published >= 10,
    prolific_publisher: m.published >= 25,
    storyteller: m.notesCount >= 10,
    multi_snap: m.photoCount >= 5,
    gallery_birder: m.photoCount >= 25,
    portrait_pro: m.photoCount >= 50,
    shutter_legend: m.photoCount >= 100,
    live_look: m.livePhotoProxy >= 1,
    photo_publisher: m.photoPosts >= 10,
    field_notes: m.manualCount >= 10,
    dual_sense: m.bothIdCount >= 1,
    ai_naturalist: m.aiIdCount >= 25,
    album_keeper: m.maxPhotosOnSighting >= 3,
    sound_scout: m.audioCount >= 1,
    ear_to_sky: m.audioCount >= 5,
    sound_archive: m.audioCount >= 15,
    sound_collector: m.audioCount >= 25,
    acoustic_legend: m.audioCount >= 50,
    live_listener: m.liveSoundProxy >= 1,
    dawn_chorus: m.before7am >= 1,
    twilight_chorus: m.twilightCount >= 1,
    night_listener: m.after8pm >= 1,
    rare_find: m.rareCount >= 1,
    common_ground: m.commonCount >= 10,
    uncommon_eye: m.uncommonCount >= 5,
    treasure_hunter: m.rareCount >= 5,
    jackpot: m.rareCount >= 10,
    rarity_collector: m.rareCount >= 15,
    full_spectrum: m.commonCount >= 1 && m.uncommonCount >= 1 && m.rareCount >= 1,
    social_flyer: input.friends >= 1,
    friendly_flock: input.friends >= 5,
    community_nest: input.friends >= 15,
    flock_leader: input.friends >= 25,
    first_cheer: extras.likesReceived >= 1,
    crowd_favorite: extras.likesReceived >= 50,
    beloved_birder: extras.likesReceived >= 100,
    superfan: extras.likesReceived >= 250,
    conversation_starter: extras.commentsLeft >= 10,
    community_voice: extras.commentsLeft >= 25,
    active_commenter: extras.commentsLeft >= 50,
    amplifier: extras.repostsGiven >= 1,
    signal_booster: extras.repostsGiven >= 10,
    guide_author: extras.fieldGuideAuthorCredits >= 1,
    field_guide_writer: extras.fieldGuideAuthorCredits >= 5,
    new_horizons: m.cityCount >= 3,
    traveler: m.cityCount >= 8,
    globetrotter: m.cityCount >= 15,
    patch_regular: m.maxPatchCount >= 10,
    patch_master: m.maxPatchCount >= 25,
    local_explorer: m.uniquePatchCount >= 5,
    on_the_map: m.gpsCount >= 10,
    four_seasons: m.seasonsLogged >= 4,
    year_round_birder: m.uniqueMonths >= 12,
    big_day: m.maxDayCount >= 3,
    mega_day: m.maxDayCount >= 5,
    weekend_warrior: m.uniqueDays >= 5,
    weekly_rhythm: m.longestStreak >= 7,
    fortnight_streak: m.longestStreak >= 14,
    thirty_day_streak: m.longestStreak >= 30,
    consistent_birder: m.uniqueDays >= 30,
    month_of_birding: m.weeksInMonthMax >= 4,
    early_riser: m.before8am >= 10,
    sunrise_regular: m.before8am >= 25,
    night_owl: m.after8pm >= 10,
  };

  const earnedDates = computeBadgeEarnedDates(input.sightings);

  return badges.map((badge) => ({
    ...badge,
    earned: earnedById[badge.id] ?? false,
    earnedAt: earnedById[badge.id] ? earnedDates[badge.id] ?? null : null,
  }));
}

/** All badge definitions for previews and admin tools. */
export function listAllBadgeDefinitions(): ProfileBadge[] {
  return buildProfileBadges({ sightings: [], friends: 0 });
}

export function groupBadgesByFamily(badges: ProfileBadge[]): Record<BadgeFamily, ProfileBadge[]> {
  const grouped = Object.fromEntries(
    BADGE_FAMILY_ORDER.map((family) => [family, [] as ProfileBadge[]]),
  ) as Record<BadgeFamily, ProfileBadge[]>;

  for (const badge of badges) {
    grouped[badge.family].push(badge);
  }

  return grouped;
}
