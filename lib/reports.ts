import { supabase } from "@/lib/supabase";

function duplicateReportError(entity: string): Error {
  return new Error(`You have already reported this ${entity}.`);
}

export async function reportPost(
  reporterId: string,
  sightingId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from("post_reports").insert({
    reporter_id: reporterId,
    sighting_id: sightingId,
    reason,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") throw duplicateReportError("post");
    throw error;
  }
}

export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from("user_reports").insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
    source: "report",
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") throw duplicateReportError("user");
    throw error;
  }
}

export async function reportComment(
  reporterId: string,
  commentId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from("comment_reports").insert({
    reporter_id: reporterId,
    comment_id: commentId,
    reason,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") throw duplicateReportError("comment");
    throw error;
  }
}
