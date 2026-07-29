import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BugReportBody {
  description?: string;
  steps?: string;
  deviceInfo?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  let body: BugReportBody;
  try {
    body = (await req.json()) as BugReportBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const description = body.description?.trim();
  if (!description || description.length < 5) {
    return jsonResponse({ error: "Description required" }, 400);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const username = (profile as { username?: string } | null)?.username ?? "unknown";

  if (webhookUrl) {
    const content = [
      "🐛 **Burd bug report**",
      `**From:** @${username} (\`${user.id.slice(0, 8)}…\`)`,
      `**Device:** ${body.deviceInfo ?? "unknown"}`,
      "",
      description,
      body.steps?.trim() ? `\n**Steps:**\n${body.steps.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });

    if (!discordRes.ok) {
      return jsonResponse({ error: "Discord webhook failed" }, 502);
    }
  }

  return jsonResponse({ ok: true, skippedDiscord: !webhookUrl });
});
