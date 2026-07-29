import { getFunctionErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type {
  DistanceUnit,
  NotificationPrefs,
  Profile,
  SightingVisibility,
} from "@/types";
import { normalizeNotificationPrefs } from "@/lib/notificationPrefs";

export interface PrivacySettingsUpdate {
  default_sighting_visibility?: SightingVisibility;
  share_exact_coordinates?: boolean;
  location_fuzz_km?: number;
  distance_unit?: DistanceUnit;
}

export async function updatePrivacySettings(
  userId: string,
  fields: PrivacySettingsUpdate,
): Promise<void> {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw error;
}

export async function updateDistanceUnit(
  userId: string,
  unit: DistanceUnit,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ distance_unit: unit })
    .eq("id", userId);
  if (error) throw error;
}

export function profilePrivacyDefaults(profile: Profile | null): {
  defaultVisibility: SightingVisibility;
  shareExactCoordinates: boolean;
  locationFuzzKm: number;
  distanceUnit: DistanceUnit;
  notificationPrefs: NotificationPrefs;
} {
  return {
    defaultVisibility: profile?.default_sighting_visibility ?? "public",
    shareExactCoordinates: profile?.share_exact_coordinates ?? false,
    locationFuzzKm: profile?.location_fuzz_km ?? 1,
    distanceUnit: profile?.distance_unit ?? "km",
    notificationPrefs: normalizeNotificationPrefs(profile?.notification_prefs),
  };
}

interface ExportResponse {
  ok?: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function exportUserData(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke<ExportResponse>(
    "export-user-data",
    { method: "POST" },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.data) {
    throw new Error("Export returned no data.");
  }

  return data.data;
}

interface BugReportPayload {
  description: string;
  steps?: string;
  deviceInfo: string;
}

interface BugReportResponse {
  ok?: boolean;
  error?: string;
}

export async function submitBugReport(payload: BugReportPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke<BugReportResponse>(
    "report-bug",
    { method: "POST", body: payload },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.ok) {
    throw new Error("Could not submit bug report.");
  }
}
