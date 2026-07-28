/** Where email confirmation / auth redirects should land after the user taps the link. */
export const AUTH_EMAIL_REDIRECT_TO = "https://burdapp.com/app/";

const WEB_APP_BASE = "/app";

/** OAuth return URL for Google (and other browser-based providers). */
export function getOAuthRedirectUri(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${WEB_APP_BASE}/auth/callback`;
  }
  // Native — resolved at runtime via expo-auth-session.
  return "burd://auth/callback";
}
