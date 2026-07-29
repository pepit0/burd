import type { NotificationPrefs } from "@/types";
import { supabase } from "@/lib/supabase";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  likes: true,
  comments: true,
  follows: true,
  reposts: true,
  nearby_rare: true,
};

export function normalizeNotificationPrefs(
  raw: Partial<NotificationPrefs> | null | undefined,
): NotificationPrefs {
  return {
    likes: raw?.likes ?? true,
    comments: raw?.comments ?? true,
    follows: raw?.follows ?? true,
    reposts: raw?.reposts ?? true,
    nearby_rare: raw?.nearby_rare ?? true,
  };
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", userId);
  if (error) throw error;
}

export function activityTypeToPrefKey(
  type: string,
): keyof NotificationPrefs | null {
  switch (type) {
    case "like":
      return "likes";
    case "comment":
      return "comments";
    case "follow":
      return "follows";
    case "repost":
      return "reposts";
    case "milestone":
    case "log":
      return "nearby_rare";
    default:
      return null;
  }
}

export const NOTIFICATION_PREF_LABELS: {
  key: keyof NotificationPrefs;
  label: string;
  detail: string;
}[] = [
  { key: "likes", label: "Likes", detail: "When someone likes your post" },
  { key: "comments", label: "Comments", detail: "When someone comments on your post" },
  { key: "follows", label: "Friends", detail: "Friend requests and acceptances" },
  { key: "reposts", label: "Reposts", detail: "When someone reposts your sighting" },
  {
    key: "nearby_rare",
    label: "Nearby rare sightings",
    detail: "Rare birds reported near you (coming soon)",
  },
];
