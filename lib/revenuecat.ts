import { Platform } from "react-native";
import Constants from "expo-constants";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOfferings,
} from "react-native-purchases";

/** Entitlement identifier for "Burd — Birding Together Pro" in RevenueCat. */
export const BURD_PRO_ENTITLEMENT_ID = "burd_pro";

export const BURD_PRO_ENTITLEMENT_DISPLAY_NAME = "Burd — Birding Together Pro";

/** App Store / Play Store product identifiers attached to the entitlement. */
export const BURD_PRODUCT_IDS = {
  monthly: "monthly",
  yearly: "yearly",
} as const;

export function isPurchasesSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function getRevenueCatApiKey(): string | null {
  const extra = Constants.expoConfig?.extra as { revenueCatApiKey?: string } | undefined;
  const fromExtra = extra?.revenueCatApiKey?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();
  return fromEnv || fromExtra || "test_CbHRfMBnkTZdBHTxDHixHaAFQZk";
}

let configured = false;

export async function configureRevenueCat(appUserId?: string | null): Promise<boolean> {
  if (!isPurchasesSupported()) {
    return false;
  }
  if (configured) {
    return true;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn("[RevenueCat] Missing API key.");
    return false;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

  Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });

  configured = true;
  return true;
}

export function isProEntitlementActive(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[BURD_PRO_ENTITLEMENT_ID] !== undefined;
}

export function getActiveProEntitlement(customerInfo: CustomerInfo | null | undefined) {
  if (!customerInfo) return null;
  return customerInfo.entitlements.active[BURD_PRO_ENTITLEMENT_ID] ?? null;
}

export function formatPurchasesError(error: unknown): string {
  const purchasesError = error as PurchasesError;
  if (purchasesError?.userCancelled) {
    return "Purchase cancelled.";
  }
  if (purchasesError?.message) {
    return purchasesError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong with your subscription.";
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn("[RevenueCat] getCustomerInfo failed:", formatPurchasesError(error));
    return null;
  }
}

export async function fetchOfferings(): Promise<PurchasesOfferings | null> {
  if (!isPurchasesSupported()) return null;
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.warn("[RevenueCat] getOfferings failed:", formatPurchasesError(error));
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (!isPurchasesSupported()) {
    throw new Error("Subscriptions are only available in the iOS and Android apps.");
  }
  return Purchases.restorePurchases();
}

export async function logInRevenueCat(appUserId: string): Promise<CustomerInfo | null> {
  if (!isPurchasesSupported()) return null;
  try {
    const { customerInfo } = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (error) {
    console.warn("[RevenueCat] logIn failed:", formatPurchasesError(error));
    return null;
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (!isPurchasesSupported()) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn("[RevenueCat] logOut failed:", formatPurchasesError(error));
  }
}
