import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface PushPayload {
  activity_id?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, string>;
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

  let payload: PushPayload;
  try {
    payload = (await req.json()) as PushPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload.activity_id) {
    return new Response("Missing activity_id", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: activity, error: activityError } = await supabase
    .from("activity")
    .select(
      "id, recipient_id, actor_id, type, sighting_id, detail, created_at, actor:profiles!actor_id(username)",
    )
    .eq("id", payload.activity_id)
    .maybeSingle();

  if (activityError || !activity) {
    return new Response("Activity not found", { status: 404 });
  }

  const createdMs = new Date(activity.created_at).getTime();
  if (Date.now() - createdMs > 60_000) {
    return new Response("Activity too old", { status: 400 });
  }

  const { data: tokens, error: tokenError } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", activity.recipient_id);

  if (tokenError || !tokens?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const actorName =
    (activity.actor as { username?: string } | null)?.username ?? "Someone";
  const title = "Burd";
  const body = `@${actorName} ${activity.detail ?? "sent you a notification"}`;

  const messages: ExpoPushMessage[] = tokens.map((row) => ({
    to: row.token,
    title,
    body,
    sound: "default",
    data: {
      activity_id: activity.id,
      type: activity.type,
      sighting_id: activity.sighting_id ?? "",
      actor_id: activity.actor_id ?? "",
    },
  }));

  const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!pushRes.ok) {
    const errText = await pushRes.text();
    console.error("Expo push failed:", errText);
    return new Response("Push delivery failed", { status: 502 });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
