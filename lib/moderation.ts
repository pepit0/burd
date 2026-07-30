import { supabase } from "@/lib/supabase";
import type {
  AccountStatus,
  AdminPostEditInput,
  CommentReport,
  ModerationAction,
  PostReport,
  Profile,
  UserReport,
  UserRole,
} from "@/types";

export function isProfileSuspended(profile: Pick<
  Profile,
  "suspended" | "suspended_until"
>): boolean {
  if (!profile.suspended) return false;
  if (!profile.suspended_until) return true;
  return new Date(profile.suspended_until).getTime() > Date.now();
}

export function formatSuspensionExpiry(until: string | null | undefined): string {
  if (!until) return "Indefinite";
  return new Date(until).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function refreshSuspension(userId: string): Promise<void> {
  const { error } = await supabase.rpc("refresh_suspension", { uid: userId });
  if (error) throw error;
}

export async function getMyAccountStatus(userId: string): Promise<AccountStatus> {
  await refreshSuspension(userId).catch(() => undefined);

  const { data, error } = await supabase
    .from("profiles")
    .select("role, suspended, suspended_until, suspension_reason")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      role: "user",
      suspended: false,
      suspendedUntil: null,
      suspensionReason: null,
      isSuspended: false,
    };
  }

  const role = (data.role as UserRole | undefined) ?? "user";
  const suspendedUntil = (data.suspended_until as string | null) ?? null;
  const suspensionReason = (data.suspension_reason as string | null) ?? null;
  const suspended = Boolean(data.suspended);
  const isSuspended = isProfileSuspended({ suspended, suspended_until: suspendedUntil });

  return {
    role,
    suspended,
    suspendedUntil,
    suspensionReason,
    isSuspended,
  };
}

export async function removePostAsAdmin(
  sightingId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_post", {
    p_sighting_id: sightingId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function removePostAuthorAsAdmin(
  sightingId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_post_author", {
    p_sighting_id: sightingId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function updatePostAsAdmin(
  sightingId: string,
  input: AdminPostEditInput,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_post", {
    p_sighting_id: sightingId,
    p_payload: input,
    p_reason: reason?.trim() || "Post edited by admin",
  });
  if (error) throw error;
}

export async function suspendUserAsAdmin(
  userId: string,
  reason: string,
  suspendedUntil: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("admin_suspend_user", {
    p_user_id: userId,
    p_reason: reason.trim(),
    p_suspended_until: suspendedUntil,
  });
  if (error) throw error;
}

export async function unsuspendUserAsAdmin(
  userId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_unsuspend_user", {
    p_user_id: userId,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function grantAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_grant_admin", {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function revokeAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_revoke_admin", {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function adminUpdateUsername(
  userId: string,
  newUsername: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_username", {
    p_user_id: userId,
    p_new_username: newUsername,
  });
  if (error) throw error;
}

export async function getAutoBetaBadgeEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("auto_beta_badge_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.auto_beta_badge_enabled ?? true);
}

export async function setAutoBetaBadgeEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_auto_beta_badge", {
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function updateUserBadgesAsAdmin(
  userId: string,
  badges: { isVerified: boolean; isBeta: boolean },
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_user_badges", {
    p_user_id: userId,
    p_is_verified: badges.isVerified,
    p_is_beta: badges.isBeta,
  });
  if (error) throw error;
}

export async function getPendingReports(limit = 50): Promise<PostReport[]> {
  const { data: reports, error } = await supabase
    .from("post_reports")
    .select("id, reporter_id, sighting_id, reason, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!reports?.length) return [];

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id as string))];
  const sightingIds = [...new Set(reports.map((r) => r.sighting_id as string))];

  const [sightingsRes, reportersRes] = await Promise.all([
    supabase
      .from("sightings")
      .select("id, species, photo_url, user_id")
      .in("id", sightingIds),
    supabase.from("profiles").select("id, username").in("id", reporterIds),
  ]);

  if (reportersRes.error) throw reportersRes.error;
  if (sightingsRes.error) throw sightingsRes.error;

  const reporterMap = new Map(
    (reportersRes.data ?? []).map((row) => [row.id as string, row.username as string]),
  );

  const sightingUserIds = [
    ...new Set((sightingsRes.data ?? []).map((row) => row.user_id as string)),
  ];
  const authorsRes =
    sightingUserIds.length > 0
      ? await supabase.from("profiles").select("id, username").in("id", sightingUserIds)
      : { data: [], error: null };
  if (authorsRes.error) throw authorsRes.error;

  const authorMap = new Map(
    (authorsRes.data ?? []).map((row) => [row.id as string, row.username as string]),
  );

  const sightingMap = new Map(
    (sightingsRes.data ?? []).map((row) => [
      row.id as string,
      {
        species: row.species as string,
        photo_url: row.photo_url as string | null,
        user_id: row.user_id as string,
        username: authorMap.get(row.user_id as string) ?? "unknown",
      },
    ]),
  );

  return reports.map((row) => ({
    id: row.id as string,
    reporter_id: row.reporter_id as string,
    sighting_id: row.sighting_id as string,
    reason: (row.reason as string | null) ?? null,
    status: (row.status as string | undefined) ?? "pending",
    created_at: row.created_at as string,
    reporter: { username: reporterMap.get(row.reporter_id as string) ?? "unknown" },
    sighting: sightingMap.get(row.sighting_id as string) ?? null,
  }));
}

export async function getPendingCommentReports(limit = 50): Promise<CommentReport[]> {
  const { data: reports, error } = await supabase
    .from("comment_reports")
    .select("id, reporter_id, comment_id, reason, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!reports?.length) return [];

  const commentIds = [...new Set(reports.map((r) => r.comment_id as string))];
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id as string))];

  const [{ data: comments, error: commentError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase
        .from("comments")
        .select("id, body, sighting_id, user_id")
        .in("id", commentIds),
      supabase.from("profiles").select("id, username").in("id", reporterIds),
    ]);

  if (commentError) throw commentError;
  if (profileError) throw profileError;

  const commentMap = new Map(
    (comments ?? []).map((row) => [
      row.id as string,
      {
        body: row.body as string,
        sighting_id: row.sighting_id as string,
        user_id: row.user_id as string,
      },
    ]),
  );
  const usernameMap = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.username as string]),
  );

  return reports.map((row) => ({
    id: row.id as string,
    reporter_id: row.reporter_id as string,
    comment_id: row.comment_id as string,
    reason: row.reason as string,
    status: row.status as string,
    created_at: row.created_at as string,
    reporter: { username: usernameMap.get(row.reporter_id as string) ?? "unknown" },
    comment: commentMap.get(row.comment_id as string) ?? null,
  }));
}

export async function getPendingUserReports(limit = 50): Promise<UserReport[]> {
  const { data: reports, error } = await supabase
    .from("user_reports")
    .select("id, reporter_id, reported_user_id, reason, source, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!reports?.length) return [];

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id as string))];
  const reportedIds = [...new Set(reports.map((r) => r.reported_user_id as string))];
  const profileIds = [...new Set([...reporterIds, ...reportedIds])];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", profileIds);

  if (profileError) throw profileError;

  const usernameMap = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.username as string]),
  );

  return reports.map((row) => ({
    id: row.id as string,
    reporter_id: row.reporter_id as string,
    reported_user_id: row.reported_user_id as string,
    reason: row.reason as string,
    source: row.source as string,
    status: row.status as string,
    created_at: row.created_at as string,
    reporter: { username: usernameMap.get(row.reporter_id as string) ?? "unknown" },
    reported_user: {
      username: usernameMap.get(row.reported_user_id as string) ?? "unknown",
    },
  }));
}

export async function dismissReport(
  reportType: "post" | "user" | "comment",
  reportId: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_dismiss_report", {
    p_report_type: reportType,
    p_report_id: reportId,
  });
  if (error) throw error;
}

export async function resolveReport(
  reportType: "post" | "user" | "comment",
  reportId: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_report_type: reportType,
    p_report_id: reportId,
  });
  if (error) throw error;
}

export async function getRecentModerationLog(limit = 30): Promise<ModerationAction[]> {
  const { data, error } = await supabase
    .from("moderation_actions")
    .select(
      "id, actor_id, action, target_user_id, target_sighting_id, reason, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!data?.length) return [];

  const actorIds = [...new Set(data.map((row) => row.actor_id as string))];
  const targetUserIds = [
    ...new Set(
      data
        .map((row) => row.target_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profileIds = [...new Set([...actorIds, ...targetUserIds])];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", profileIds);

  if (profilesError) throw profilesError;

  const usernameMap = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.username as string]),
  );

  return data.map((row) => ({
    id: row.id as string,
    actor_id: row.actor_id as string,
    action: row.action as ModerationAction["action"],
    target_user_id: (row.target_user_id as string | null) ?? null,
    target_sighting_id: (row.target_sighting_id as string | null) ?? null,
    reason: row.reason as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: row.created_at as string,
    actor: { username: usernameMap.get(row.actor_id as string) ?? "admin" },
    target_user: row.target_user_id
      ? { username: usernameMap.get(row.target_user_id as string) ?? "user" }
      : null,
  }));
}

export async function listAdmins(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("username");

  if (error) throw error;
  return (data ?? []) as Profile[];
}

export function suspensionDurationToDate(days: number | null): string | null {
  if (days == null) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
