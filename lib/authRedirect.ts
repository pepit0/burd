import * as Linking from "expo-linking";
import { Platform } from "react-native";

const WEB_APP_BASE = "/app";
const PRODUCTION_EMAIL_CALLBACK = "https://burdapp.com/app/auth/callback";

/** Where email confirmation links should land (must match Supabase redirect URLs). */
export function getEmailAuthRedirectUri(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${WEB_APP_BASE}/auth/callback`;
    }
    return PRODUCTION_EMAIL_CALLBACK;
  }
  // Email links open in the system browser — always use the public web callback.
  return PRODUCTION_EMAIL_CALLBACK;
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
