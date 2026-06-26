import { supabase } from "@/lib/supabase";

export async function reportPost(
  reporterId: string,
  sightingId: string,
): Promise<void> {
  const { error } = await supabase.from("post_reports").insert({
    reporter_id: reporterId,
    sighting_id: sightingId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already reported this post.");
    }
    throw error;
  }
}
