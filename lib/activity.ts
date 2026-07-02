import { supabase } from "@/lib/supabase";
import type { ActivityItem } from "@/types";

const ACTIVITY_SELECT =
  "*, actor:profiles!actor_id(username, avatar_color), sighting:sightings(species, photo_url, audio_url)";

export async function getActivity(userId: string): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("activity")
    .select(ACTIVITY_SELECT)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityItem[];
}

export async function getUnreadActivityCount(): Promise<number> {
  const { data, error } = await supabase.rpc("unread_activity_count");
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function markActivityRead(activityId: string): Promise<void> {
  const { error } = await supabase
    .from("activity")
    .update({ read_at: new Date().toISOString() })
    .eq("id", activityId)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllActivityRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("activity")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function clearActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from("activity").delete().eq("id", activityId);
  if (error) throw error;
}

export async function clearAllActivity(userId: string): Promise<void> {
  const { error } = await supabase
    .from("activity")
    .delete()
    .eq("recipient_id", userId);
  if (error) throw error;
}

export async function savePushToken(
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw error;
}

export async function removePushToken(token: string): Promise<void> {
  const { error } = await supabase.from("push_tokens").delete().eq("token", token);
  if (error) throw error;
}
