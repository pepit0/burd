import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getPostHogConfig, isAnalyticsEnabled } from "@/lib/analytics.env";

export type SignupPlatform = "ios" | "android" | "web";
export type SignupMethod = "email" | "apple" | "google";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const DISTINCT_ID_KEY = "burd:analytics:distinct_id";
const ANON_ID_KEY = "burd:analytics:anon_id";

let initialized = false;
let distinctId: string | null = null;
let identifiedUserId: string | null = null;

export function getSignupPlatform(): SignupPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

async function readStorage(key: string): Promise<string | null> {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function removeStorage(key: string): Promise<void> {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

async function ensureDistinctId(): Promise<string> {
  if (distinctId) return distinctId;

  const stored =
    (await readStorage(DISTINCT_ID_KEY)) ?? (await readStorage(ANON_ID_KEY));
  if (stored) {
    distinctId = stored;
    return distinctId;
  }

  distinctId = Crypto.randomUUID();
  await writeStorage(ANON_ID_KEY, distinctId);
  return distinctId;
}

function baseProperties(): AnalyticsProperties {
  return {
    platform: getSignupPlatform(),
    app_version: process.env.EXPO_PUBLIC_APP_VERSION ?? "1.0.0",
    environment: __DEV__ ? "development" : "production",
  };
}

async function capture(
  event: string,
  properties: AnalyticsProperties = {},
  options?: { userId?: string | null },
): Promise<void> {
  if (!isAnalyticsEnabled()) return;

  const { apiKey, host } = getPostHogConfig();
  if (!apiKey) return;

  const id = options?.userId ?? identifiedUserId ?? (await ensureDistinctId());

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: id,
        properties: {
          ...baseProperties(),
          ...properties,
          $lib: "burd-analytics",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[analytics] capture failed:", event, err);
    }
  }
}

export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await ensureDistinctId();
  void capture("app_initialized");
}

export async function identify(
  userId: string,
  traits: AnalyticsProperties = {},
): Promise<void> {
  identifiedUserId = userId;
  distinctId = userId;
  await writeStorage(DISTINCT_ID_KEY, userId);

  if (!isAnalyticsEnabled()) return;

  const { apiKey, host } = getPostHogConfig();
  if (!apiKey) return;

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: "$identify",
        distinct_id: userId,
        properties: {
          $set: {
            ...traits,
            platform: getSignupPlatform(),
          },
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[analytics] identify failed:", err);
    }
  }
}

export function track(event: string, properties?: AnalyticsProperties): void {
  void capture(event, properties ?? {});
}

export function trackForUser(
  userId: string,
  event: string,
  properties?: AnalyticsProperties,
): void {
  void capture(event, properties ?? {}, { userId });
}

export async function resetAnalytics(): Promise<void> {
  identifiedUserId = null;
  distinctId = null;
  await removeStorage(DISTINCT_ID_KEY);

  const anon = Crypto.randomUUID();
  distinctId = anon;
  await writeStorage(ANON_ID_KEY, anon);
  void capture("analytics_reset");
}
