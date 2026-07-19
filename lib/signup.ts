import type { User } from "@supabase/supabase-js";
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

export async function claimUsername(
  userId: string,
  rawUsername: string,
): Promise<void> {
  const username = normalizeUsername(rawUsername);
  const validationError = validateUsername(username);
  if (validationError) throw new Error(validationError);

  const availability = await checkSignupAvailability("", username);
  if (availability.usernameTaken) {
    throw new Error("This username is already taken. Try another.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", userId);

  if (profileError) {
    const msg = profileError.message.toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      throw new Error("This username is already taken. Try another.");
    }
    throw profileError;
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      username,
      username_chosen: true,
    },
  });
  if (metaError) throw metaError;
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
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return "An account already exists with this email.";
  }
  if (lower.includes("duplicate key") && lower.includes("username")) {
    return "This username is already taken. Try another.";
  }
  return message;
}
