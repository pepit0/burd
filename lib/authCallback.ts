import { Platform } from "react-native";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

const AUTH_PARAM_PATTERN = /[?&#](code|access_token|token_hash|error)=/;

/** True when the URL may finish an email confirmation or OAuth flow. */
export function urlHasAuthCompletionParams(url: string): boolean {
  return AUTH_PARAM_PATTERN.test(url);
}

function normalizeOtpType(raw: string): EmailOtpType {
  const allowed = new Set([
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "email",
  ]);
  if (allowed.has(raw)) return raw as EmailOtpType;
  return "signup";
}

export interface CompleteAuthFromUrlOptions {
  recordConsent?: boolean;
}

/**
 * Exchange auth params from an email confirmation or OAuth redirect into a session.
 * Supports PKCE (?code=), implicit (#access_token=), and verifyOtp (?token_hash=).
 */
export async function completeAuthFromUrl(
  url: string,
  _options?: CompleteAuthFromUrlOptions,
): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(String(errorCode));
  }

  if (typeof params.code === "string" && params.code.length > 0) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }
    return;
  }

  if (typeof params.access_token === "string" && params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token:
        typeof params.refresh_token === "string" ? params.refresh_token : "",
    });
    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }
    return;
  }

  if (
    typeof params.token_hash === "string" &&
    params.token_hash.length > 0 &&
    typeof params.type === "string" &&
    params.type.length > 0
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: normalizeOtpType(params.type),
    });
    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }
    return;
  }

  throw new Error("This sign-in link is missing a session. Request a new confirmation email.");
}

/** Remove auth tokens from the browser address bar after a successful exchange. */
export function cleanAuthParamsFromUrl(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const { pathname, hash } = window.location;
  if (!urlHasAuthCompletionParams(window.location.href)) return;

  const cleanPath = pathname.endsWith("/auth/callback")
    ? pathname
    : `${pathname.replace(/\/?$/, "")}/auth/callback`;

  window.history.replaceState({}, "", cleanPath);
  if (hash && urlHasAuthCompletionParams(hash)) {
    window.history.replaceState({}, "", cleanPath);
  }
}
