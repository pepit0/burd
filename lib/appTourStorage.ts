import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppTourPhase } from "@/lib/appTourSteps";

export type AppTourStatus = "pending" | "skipped" | "completed";

export interface AppTourRecord {
  status: AppTourStatus;
  phase: "welcome" | "tour" | "plus" | null;
  stepIndex: number;
}

function storageKey(userId: string) {
  return `burd:app-tour:${userId}`;
}

function parseRecord(raw: string | null): AppTourRecord | null {
  if (!raw) return null;
  if (raw === "pending" || raw === "skipped" || raw === "completed") {
    return { status: raw, phase: raw === "pending" ? "welcome" : null, stepIndex: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppTourRecord>;
    if (
      parsed.status !== "pending" &&
      parsed.status !== "skipped" &&
      parsed.status !== "completed"
    ) {
      return null;
    }
    const phase =
      parsed.phase === "welcome" || parsed.phase === "tour" || parsed.phase === "plus"
        ? parsed.phase
        : parsed.status === "pending"
          ? "welcome"
          : null;
    return {
      status: parsed.status,
      phase,
      stepIndex: typeof parsed.stepIndex === "number" ? Math.max(0, parsed.stepIndex) : 0,
    };
  } catch {
    return null;
  }
}

export async function getAppTourRecord(userId: string): Promise<AppTourRecord | null> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  return parseRecord(raw);
}

export async function getAppTourStatus(
  userId: string,
): Promise<AppTourStatus | null> {
  const record = await getAppTourRecord(userId);
  return record?.status ?? null;
}

export async function setAppTourRecord(
  userId: string,
  record: AppTourRecord,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(record));
}

export async function setAppTourStatus(
  userId: string,
  status: AppTourStatus,
): Promise<void> {
  await setAppTourRecord(userId, {
    status,
    phase: status === "pending" ? "welcome" : null,
    stepIndex: 0,
  });
}

export async function persistAppTourProgress(
  userId: string,
  phase: Extract<AppTourPhase, "welcome" | "tour">,
  stepIndex: number,
): Promise<void> {
  await setAppTourRecord(userId, {
    status: "pending",
    phase,
    stepIndex,
  });
}

/** Call when a new account finishes username setup so the tour can start. */
export async function markAppTourPending(userId: string): Promise<void> {
  const existing = await getAppTourRecord(userId);
  if (existing?.status === "skipped" || existing?.status === "completed") return;
  await setAppTourRecord(userId, {
    status: "pending",
    phase: "welcome",
    stepIndex: 0,
  });
}
