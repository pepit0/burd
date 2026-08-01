import { supabase } from "@/lib/supabase";

export type AdminUserOnboardingIssue =
  | "ok"
  | "missing_profile"
  | "pending_onboarding"
  | "auto_profile";

export interface AdminUserDiagnostics {
  user_id: string;
  email: string | null;
  email_confirmed: boolean;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  username_chosen: string | null;
  signup_method: string | null;
  signup_platform: string | null;
  has_profile: boolean;
  profile_username: string | null;
  profile_full_name: string | null;
  issue: AdminUserOnboardingIssue;
  issue_label: string;
  can_reset_onboarding: boolean;
}

function parseDiagnosticsRow(raw: unknown): AdminUserDiagnostics | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.user_id !== "string") return null;

  const issue = row.issue;
  const validIssues: AdminUserOnboardingIssue[] = [
    "ok",
    "missing_profile",
    "pending_onboarding",
    "auto_profile",
  ];

  return {
    user_id: row.user_id,
    email: typeof row.email === "string" ? row.email : null,
    email_confirmed: Boolean(row.email_confirmed),
    email_confirmed_at:
      typeof row.email_confirmed_at === "string" ? row.email_confirmed_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    last_sign_in_at:
      typeof row.last_sign_in_at === "string" ? row.last_sign_in_at : null,
    username_chosen:
      typeof row.username_chosen === "string" ? row.username_chosen : null,
    signup_method:
      typeof row.signup_method === "string" ? row.signup_method : null,
    signup_platform:
      typeof row.signup_platform === "string" ? row.signup_platform : null,
    has_profile: Boolean(row.has_profile),
    profile_username:
      typeof row.profile_username === "string" ? row.profile_username : null,
    profile_full_name:
      typeof row.profile_full_name === "string" ? row.profile_full_name : null,
    issue: validIssues.includes(issue as AdminUserOnboardingIssue)
      ? (issue as AdminUserOnboardingIssue)
      : "pending_onboarding",
    issue_label:
      typeof row.issue_label === "string" ? row.issue_label : "Unknown state",
    can_reset_onboarding: Boolean(row.can_reset_onboarding),
  };
}

export async function lookupAdminUserDiagnostics(
  query: string,
): Promise<AdminUserDiagnostics[]> {
  const { data, error } = await supabase.rpc("admin_lookup_user_diagnostics", {
    p_query: query.trim(),
  });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map(parseDiagnosticsRow)
    .filter((row): row is AdminUserDiagnostics => row !== null);
}

export async function getAdminUserDiagnostics(
  userId: string,
): Promise<AdminUserDiagnostics> {
  const { data, error } = await supabase.rpc("admin_get_user_diagnostics", {
    p_user_id: userId,
  });
  if (error) throw error;
  const parsed = parseDiagnosticsRow(data);
  if (!parsed) throw new Error("Could not read user diagnostics.");
  return parsed;
}

export async function resetAdminUserOnboarding(
  userId: string,
  options?: { force?: boolean },
): Promise<AdminUserDiagnostics> {
  const { data, error } = await supabase.rpc("admin_reset_user_onboarding", {
    p_user_id: userId,
    p_force: options?.force ?? false,
  });
  if (error) throw error;
  const parsed = parseDiagnosticsRow(data);
  if (!parsed) throw new Error("Could not read user diagnostics after reset.");
  return parsed;
}

export function issueBadgeTone(
  issue: AdminUserOnboardingIssue,
): "ok" | "warn" | "error" {
  if (issue === "ok") return "ok";
  if (issue === "missing_profile") return "error";
  return "warn";
}
