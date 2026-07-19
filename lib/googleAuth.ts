import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

async function createSessionFromUrl(url: string): Promise<void> {
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

  // Don't await metadata writes — they race session listeners and can force a
  // second sign-in. OAuth users are routed to choose-username via provider check.
  void (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (
        user &&
        user.user_metadata?.username_chosen !== true &&
        !(
          typeof user.user_metadata?.username === "string" &&
          user.user_metadata.username.trim().length >= 3
        )
      ) {
        await supabase.auth.updateUser({
          data: { username_chosen: false },
        });
      }
    } catch {
      // Session is already valid.
    }
  })();
}

/**
 * Google sign-in via Supabase OAuth (browser sheet).
 * Requires Google provider enabled in the Supabase dashboard.
 */
export async function signInWithGoogle(): Promise<{ cancelled: boolean }> {
  const redirectTo = makeRedirectUri({ scheme: "burd", path: "auth/callback" });

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

  await createSessionFromUrl(result.url);
  return { cancelled: false };
}
