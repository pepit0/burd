import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskRequest {
  common_name?: string;
  scientific_name?: string;
  messages?: ChatMessage[];
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(commonName: string, scientificName: string): string {
  return (
    `You are a nature guide for a birding app called Burd. Answer questions about the ${commonName} (${scientificName}) in a friendly, concise tone suited for casual nature enthusiasts. Keep answers to 2-3 sentences.`
  );
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const parsed: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (record.role !== "user" && record.role !== "assistant") return null;
    if (typeof record.content !== "string" || !record.content.trim()) return null;
    parsed.push({ role: record.role, content: record.content.trim() });
  }

  if (parsed[parsed.length - 1]?.role !== "user") return null;
  return parsed;
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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: AskRequest;
  try {
    body = (await req.json()) as AskRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const commonName = body.common_name?.trim();
  const scientificName = body.scientific_name?.trim();
  if (!commonName || !scientificName) {
    return jsonResponse({ error: "Species name is required" }, 400);
  }

  const messages = parseMessages(body.messages);
  if (!messages) {
    return jsonResponse({ error: "A user question is required" }, 400);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Guide is not configured" }, 500);
  }

  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: buildSystemPrompt(commonName, scientificName),
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text().catch(() => "");
      console.error("Anthropic error", anthropicRes.status, detail);
      return jsonResponse({ error: "Could not get an answer right now" }, 502);
    }

    const data = (await anthropicRes.json()) as {
      content?: { type: string; text?: string }[];
    };
    const reply = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return jsonResponse({ error: "Empty response from guide" }, 502);
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("species-ask failed", error);
    return jsonResponse({ error: "Could not get an answer right now" }, 502);
  }
});
