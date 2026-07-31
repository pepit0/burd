import type { AuthError, User } from "@supabase/supabase-js";
import { getEmailAuthRedirectUri } from "@/lib/authRedirect";
import { getUserFacingMessage, isNetworkError } from "@/lib/errors";
import { withTransientRetry } from "@/lib/retry";
import { supabase } from "@/lib/supabase";

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!username) return "Choose a username.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Usernames must be 3–30 characters, start with a letter, and use only letters, numbers, and underscores.";
  }
  return null;
}

export const DISPLAY_NAME_MAX_LENGTH = 60;

export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (!name) return "Choose a display name.";
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display names must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Whether this signed-in user still needs the @username screen.
 * Does not call updateUser (that raced auth and caused flaky double sign-in).
 */
export async function resolveUsernameSetup(
  user: User | null | undefined,
): Promise<boolean> {
  if (!user) return false;

  const meta = user.user_metadata ?? {};

  if (meta.username_chosen === true) return false;
  if (
    typeof meta.username === "string" &&
    normalizeUsername(meta.username).length >= 3
  ) {
    return false;
  }
  // Explicitly marked as needing a pick (new email / OAuth signup).
  if (meta.username_chosen === false) return true;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as string[])
    : [];
  const identityProviders = (user.identities ?? []).map((i) => i.provider);
  const isOAuth = [...providers, ...identityProviders].some(
    (p) => p === "apple" || p === "google",
  );

  // OAuth without a chosen @username must pick one (ignore auto profile names).
  if (isOAuth) return true;

  // Legacy email accounts: already have a profile username → let them in.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("resolveUsernameSetup profile lookup failed:", error.message);
    return false;
  }

  const existing = typeof profile?.username === "string" ? profile.username : "";
  if (existing && normalizeUsername(existing).length >= 3) {
    return false;
  }

  return true;
}

interface SignupAvailability {
  emailTaken: boolean;
  usernameTaken: boolean;
}

export async function checkSignupAvailability(
  email: string,
  username: string,
): Promise<SignupAvailability> {
  const { data, error } = await supabase.rpc("check_signup_availability", {
    check_email: email.trim(),
    check_username: normalizeUsername(username),
  });

  if (error) throw error;

  const row = data as { email_taken?: boolean; username_taken?: boolean } | null;
  return {
    emailTaken: Boolean(row?.email_taken),
    usernameTaken: Boolean(row?.username_taken),
  };
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const availability = await checkSignupAvailability(email, "");
  return !availability.emailTaken;
}

export interface EmailSignUpOptions {
  email: string;
  password: string;
  emailRedirectTo: string;
  metadata: Record<string, string | boolean>;
}

/** Sign up with automatic retry on transient network failures. */
export async function signUpWithEmail({
  email,
  password,
  emailRedirectTo,
  metadata,
}: EmailSignUpOptions) {
  let lastResult: Awaited<ReturnType<typeof supabase.auth.signUp>> | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: metadata,
      },
    });
    lastResult = result;

    if (!result.error) return result;

    const authError = result.error as AuthError;
    if (!isNetworkError(authError) || attempt >= 2) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }

  return lastResult!;
}

export async function claimUsername(
  userId: string,
  rawUsername: string,
  rawDisplayName?: string,
): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const validationError = validateUsername(username);
  if (validationError) throw new Error(validationError);

  const displayName =
    rawDisplayName !== undefined ? normalizeDisplayName(rawDisplayName) : null;
  if (displayName !== null) {
    const displayNameError = validateDisplayName(displayName);
    if (displayNameError) throw new Error(displayNameError);
  }

  if (!displayName) {
    throw new Error("Choose a display name.");
  }

  await withTransientRetry(async () => {
    const { error } = await supabase.rpc("complete_user_onboarding", {
      p_username: username,
      p_display_name: displayName,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already taken")) {
        throw new Error("This username is already taken. Try another.");
      }
      if (msg.includes("confirm your email")) {
        throw new Error("Confirm your email before finishing signup.");
      }
      if (isNetworkError(error)) throw error;
      throw error;
    }
  });

  await supabase.auth.refreshSession();
}

export function signupAvailabilityMessage(
  emailTaken: boolean,
  usernameTaken: boolean,
): string {
  if (emailTaken && usernameTaken) {
    return "An account already exists with this email and username.";
  }
  if (emailTaken) {
    return "An account already exists with this email.";
  }
  if (usernameTaken) {
    return "This username is already taken. Try another.";
  }
  return "Could not create account.";
}

export function mapSignUpError(message: string): string {
  const lower = message.toLowerCase();
  if (isAlreadyRegisteredError(message)) {
    return "An account already exists with this email. Try signing in instead.";
  }
  if (lower.includes("duplicate key") && lower.includes("username")) {
    return "This username is already taken. Try another.";
  }
  return message;
}

export function isAlreadyRegisteredError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists") ||
    lower.includes("already exists with this email")
  );
}

export async function resendSignupConfirmation(
  email: string,
  password?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  const redirectTo = getEmailAuthRedirectUri();

  const { error: resendError } = await supabase.auth.resend({
    type: "signup",
    email: trimmed,
    options: { emailRedirectTo: redirectTo },
  });

  if (!resendError) {
    return { ok: true };
  }

  // Some projects only resend confirmation when signUp is called again.
  if (password && password.length >= 6) {
    const { error: signUpError, data } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (!signUpError && !data.session) {
      return { ok: true };
    }
    if (signUpError && isAlreadyRegisteredError(signUpError.message)) {
      return {
        ok: false,
        error:
          "We couldn't resend the confirmation email yet. Wait a minute and try again, or sign in if you already confirmed.",
      };
    }
    if (signUpError) {
      return { ok: false, error: getUserFacingMessage(signUpError) };
    }
  }

  return { ok: false, error: getUserFacingMessage(resendError) };
}
