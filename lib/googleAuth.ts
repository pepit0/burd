import { Platform } from "react-native";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { getSignupPlatform, track } from "@/lib/analytics";
import { getOAuthRedirectUri } from "@/lib/authRedirect";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const OAUTH_CONSENT_PENDING_KEY = "burd:oauth:record_consent";

export interface GoogleSignInOptions {
  /** Persist Terms/Privacy + age-13 consent timestamps on the auth user. */
  recordConsent?: boolean;
}

function stashOAuthConsentFlag(recordConsent?: boolean): void {
  if (!recordConsent || Platform.OS !== "web") return;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(OAUTH_CONSENT_PENDING_KEY, "1");
  }
}

function consumeOAuthConsentFlag(): boolean {
  if (Platform.OS !== "web" || typeof sessionStorage === "undefined") {
    return false;
  }
  const pending = sessionStorage.getItem(OAUTH_CONSENT_PENDING_KEY) === "1";
  sessionStorage.removeItem(OAUTH_CONSENT_PENDING_KEY);
  return pending;
}

export async function completeOAuthFromUrl(
  url: string,
  options?: GoogleSignInOptions,
): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(String(errorCode));
  }

  // PKCE / modern Supabase OAuth returns ?code=… (not tokens in the URL).
  if (typeof params.code === "string" && params.code.length > 0) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }
  } else if (typeof params.access_token === "string" && params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token:
        typeof params.refresh_token === "string" ? params.refresh_token : "",
    });
    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }
  } else {
    throw new Error("Google sign-in did not return a session.");
  }

  void syncGoogleUserMetadata(
    options?.recordConsent === true || consumeOAuthConsentFlag(),
  );
}

async function syncGoogleUserMetadata(recordConsent = false): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const metadata: Record<string, string | boolean> = {};
    const createdMs = new Date(user.created_at).getTime();
    const isNewUser = Date.now() - createdMs < 5 * 60 * 1000;

    if (
      user.user_metadata?.username_chosen !== true &&
      !(
        typeof user.user_metadata?.username === "string" &&
        user.user_metadata.username.trim().length >= 3
      )
    ) {
      metadata.username_chosen = false;
    }

    if (isNewUser && !user.user_metadata?.signup_platform) {
      metadata.signup_platform = getSignupPlatform();
      metadata.signup_method = "google";
    }

    if (recordConsent) {
      const now = new Date().toISOString();
      if (!user.user_metadata?.privacy_policy_accepted_at) {
        metadata.privacy_policy_accepted_at = now;
      }
      if (!user.user_metadata?.age_confirmed_at) {
        metadata.age_confirmed_at = now;
      }
    }

    if (Object.keys(metadata).length > 0) {
      await supabase.auth.updateUser({ data: metadata });
    }

    if (isNewUser) {
      await supabase
        .from("profiles")
        .update({
          signup_platform: getSignupPlatform(),
          signup_method: "google",
        })
        .eq("id", user.id);
    }
  } catch {
    // Session is already valid.
  }
}

function resolveRedirectUri(): string {
  return getOAuthRedirectUri();
}

/**
 * Google sign-in via Supabase OAuth.
 * Native: in-app browser sheet. Web: full-page redirect to Google.
 */
export async function signInWithGoogle(
  options?: GoogleSignInOptions,
): Promise<{ cancelled: boolean }> {
  track("sign_in_started", { sign_in_method: "google" });

  const redirectTo = resolveRedirectUri();

  if (Platform.OS === "web") {
    stashOAuthConsentFlag(options?.recordConsent);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }

    return { cancelled: false };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw new Error(getUserFacingMessage(error, error.message));
  }
  if (!data.url) {
    throw new Error("Could not start Google sign-in.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !("url" in result) || !result.url) {
    return { cancelled: true };
  }

  await completeOAuthFromUrl(result.url, options);
  return { cancelled: false };
}
