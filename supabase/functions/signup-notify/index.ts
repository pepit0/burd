import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface SignupNotifyPayload {
  user_id?: string;
}

interface ProfileRow {
  username: string;
  signup_platform: string | null;
  signup_method: string | null;
  created_at: string;
}

const POSTHOG_HOST =
  Deno.env.get("POSTHOG_HOST")?.replace(/\/$/, "") ??
  "https://us.i.posthog.com";

function platformLabel(value: string | null | undefined): string {
  switch (value) {
    case "ios":
      return "iOS app";
    case "android":
      return "Android app";
    case "web":
      return "Web app";
    default:
      return "Unknown platform";
  }
}

function methodLabel(value: string | null | undefined): string {
  switch (value) {
    case "apple":
      return "Apple Sign-In";
    case "google":
      return "Google";
    case "email":
      return "Email";
    default:
      return "Unknown method";
  }
}

async function capturePostHog(
  userId: string,
  event: string,
  properties: Record<string, string>,
): Promise<void> {
  const apiKey = Deno.env.get("POSTHOG_API_KEY");
  if (!apiKey) return;

  await fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: userId,
      properties: {
        ...properties,
        $lib: "burd-signup-notify",
      },
      timestamp: new Date().toISOString(),
    }),
  });
}

async function sendSignupEmail(details: {
  userId: string;
  email: string | null;
  username: string;
  platform: string | null;
  method: string | null;
  createdAt: string;
}): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyRaw = Deno.env.get("SIGNUP_NOTIFY_EMAIL");
  if (!resendKey || !notifyRaw) {
    console.warn("signup-notify: RESEND_API_KEY or SIGNUP_NOTIFY_EMAIL not set");
    return false;
  }

  const recipients = notifyRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!recipients.length) return false;

  const fromEmail = Deno.env.get("SIGNUP_NOTIFY_FROM") ?? "Burd <notifications@burdapp.com>";
  const created = new Date(details.createdAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Denver",
  });

  const subject = `New Burd signup: @${details.username}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a;">
      <h2 style="margin: 0 0 12px; color: #5f9470;">New Burd user signed up</h2>
      <p style="margin: 0 0 16px;">Someone just created an account on Burd.</p>
      <table style="border-collapse: collapse; font-size: 15px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Username</td><td><strong>@${details.username}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td>${details.email ?? "(hidden / OAuth)"}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Platform</td><td>${platformLabel(details.platform)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Method</td><td>${methodLabel(details.method)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #666;">Signed up</td><td>${created}</td></tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 13px; color: #888;">User ID: ${details.userId}</p>
    </div>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipients,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("signup-notify: Resend failed:", errText);
    return false;
  }

  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  let payload: SignupNotifyPayload;
  try {
    payload = (await req.json()) as SignupNotifyPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload.user_id) {
    return new Response("Missing user_id", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    payload.user_id,
  );
  if (authError || !authUser.user) {
    return new Response("User not found", { status: 404 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, signup_platform, signup_method, created_at")
    .eq("id", payload.user_id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const createdAt = profile.created_at ?? authUser.user.created_at;
  const createdMs = new Date(createdAt).getTime();
  if (Date.now() - createdMs > 120_000) {
    return new Response("Signup too old", { status: 400 });
  }

  const email = authUser.user.email ?? null;
  const username = profile.username;

  await capturePostHog(payload.user_id, "user_signed_up", {
    username,
    email: email ?? "",
    signup_platform: profile.signup_platform ?? "unknown",
    signup_method: profile.signup_method ?? "unknown",
    source: "server",
  });

  const emailed = await sendSignupEmail({
    userId: payload.user_id,
    email,
    username,
    platform: profile.signup_platform,
    method: profile.signup_method,
    createdAt,
  });

  return new Response(JSON.stringify({ ok: true, emailed }), {
    headers: { "Content-Type": "application/json" },
  });
});
