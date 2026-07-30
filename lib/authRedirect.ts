import * as Linking from "expo-linking";
import { Platform } from "react-native";

/** Where email confirmation / auth redirects should land after the user taps the link. */
export const AUTH_EMAIL_REDIRECT_TO = "https://burdapp.com/app/";

const WEB_APP_BASE = "/app";

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
