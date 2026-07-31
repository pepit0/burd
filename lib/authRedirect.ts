import * as Linking from "expo-linking";
import { Platform } from "react-native";

const WEB_APP_BASE = "/app";
const PRODUCTION_EMAIL_CALLBACK = "https://burdapp.com/app/auth/callback";
const NATIVE_AUTH_CALLBACK_PATH = "auth/callback";

/** Where email confirmation links should land (must match Supabase redirect URLs). */
export function getEmailAuthRedirectUri(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${WEB_APP_BASE}/auth/callback`;
    }
    return PRODUCTION_EMAIL_CALLBACK;
  }
  return Linking.createURL(NATIVE_AUTH_CALLBACK_PATH);
}

/** Deep link to reopen the native app after email confirmation (burd://auth/callback…). */
export function getNativeAuthCallbackDeepLink(queryAndHash = ""): string {
  const suffix = queryAndHash.startsWith("?") || queryAndHash.startsWith("#")
    ? queryAndHash
    : queryAndHash
      ? `?${queryAndHash}`
      : "";
  return Linking.createURL(`${NATIVE_AUTH_CALLBACK_PATH}${suffix}`);
}

/** @deprecated Use getEmailAuthRedirectUri() so redirects hit /auth/callback. */
export const AUTH_EMAIL_REDIRECT_TO = PRODUCTION_EMAIL_CALLBACK;

/** OAuth return URL for Google (and other browser-based providers). */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${WEB_APP_BASE}/auth/callback`;
    }
    return "https://burdapp.com/app/auth/callback";
  }

  return Linking.createURL("auth/callback");
}
