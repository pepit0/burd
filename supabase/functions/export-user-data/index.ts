import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
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

  const [profileRes, sightingsRes, commentsRes, activityRes] = await Promise.all([
    userClient.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    userClient.from("sightings").select("*").eq("user_id", user.id).limit(500),
    userClient.from("comments").select("*").eq("user_id", user.id).limit(500),
    userClient.from("activity").select("*").eq("recipient_id", user.id).limit(200),
  ]);

  if (profileRes.error) {
    return jsonResponse({ error: profileRes.error.message }, 500);
  }

  const exportPayload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    profile: profileRes.data,
    sightings: sightingsRes.data ?? [],
    comments: commentsRes.data ?? [],
    activity_received: activityRes.data ?? [],
  };

  return jsonResponse({ ok: true, data: exportPayload });
});
