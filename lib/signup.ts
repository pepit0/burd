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
    return "This username is already taken.";
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
    return "This username is already taken.";
  }
  return message;
}
