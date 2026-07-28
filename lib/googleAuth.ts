import { Platform } from "react-native";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { getSignupPlatform, track } from "@/lib/analytics";
import { getOAuthRedirectUri } from "@/lib/authRedirect";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export async function completeOAuthFromUrl(url: string): Promise<void> {
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

  void syncGoogleUserMetadata();
}

async function syncGoogleUserMetadata(): Promise<void> {
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
  if (Platform.OS === "web") {
    return getOAuthRedirectUri();
  }
  return makeRedirectUri({ scheme: "burd", path: "auth/callback" });
}

/**
 * Google sign-in via Supabase OAuth.
 * Native: in-app browser sheet. Web: full-page redirect to Google.
 */
export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
  track("sign_in_started", { sign_in_method: "google" });

  const redirectTo = resolveRedirectUri();

  if (Platform.OS === "web") {
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

  await completeOAuthFromUrl(result.url);
  return { cancelled: false };
}
