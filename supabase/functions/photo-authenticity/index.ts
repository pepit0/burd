import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLASSIFICATION_PROMPT = `Look at this image carefully. Classify it into exactly one of these categories:
- real: a genuine photograph taken directly of a real bird or scene in the field (through a camera lens, not through another screen)
- screen: a photo of a monitor, TV, laptop, tablet, phone, projector, or any digital display — including when a bird appears on that display
- reproduction: a photo of a painting, drawing, printed photo, book illustration, or other physical reproduction
- ai: an AI-generated or digitally synthesized image
- stock: a stock photo or downloaded image from the internet

Important rules:
- If you see bezels, screen glare, pixels, UI chrome, or a rectangular glowing display, choose screen.
- If the bird is on a computer/phone/TV screen, choose screen even if it looks realistic.
- If unsure between real and screen, choose screen.

Reply with only one word from the list above.`;

const VALID_CLASSIFICATIONS = new Set([
  "real",
  "screen",
  "reproduction",
  "ai",
  "stock",
]);

const REJECTION_MESSAGES: Record<string, string> = {
  screen:
    "Please use a real photo, not a screenshot or photo of a screen.",
  reproduction:
    "Please use a real photo, not a photo of a painting or printed image.",
  ai: "AI-generated images can't be used for sighting logs.",
  stock:
    "Please use your own photo, not an image downloaded from the internet.",
};

const MODEL = "claude-haiku-4-5-20251001";

interface AuthenticityRequest {
  image_base64?: string;
  media_type?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseClassification(text: string): string | null {
  const token = text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, "");
  if (token && VALID_CLASSIFICATIONS.has(token)) return token;
  for (const label of VALID_CLASSIFICATIONS) {
    if (text.toLowerCase().includes(label)) return label;
  }
  return null;
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

  let body: AuthenticityRequest;
  try {
    body = (await req.json()) as AuthenticityRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const imageBase64 = body.image_base64?.trim();
  if (!imageBase64) {
    return jsonResponse({ error: "image_base64 is required" }, 400);
  }

  const mediaType = body.media_type?.trim() || "image/jpeg";

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Photo validation is not configured" }, 500);
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: CLASSIFICATION_PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text().catch(() => "");
      console.error("Anthropic photo-authenticity error", anthropicRes.status, detail);
      return jsonResponse({ error: "Could not validate this photo right now" }, 502);
    }

    const data = (await anthropicRes.json()) as {
      content?: { type: string; text?: string }[];
    };
    const raw = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!raw) {
      return jsonResponse({ error: "Could not validate this photo right now" }, 502);
    }

    const classification = parseClassification(raw);
    if (!classification) {
      console.warn("Unexpected photo classification:", raw);
      return jsonResponse({ error: "Could not validate this photo right now" }, 502);
    }

    if (classification === "real") {
      return jsonResponse({ classification: "real", passed: true });
    }

    return jsonResponse({
      classification,
      passed: false,
      message: REJECTION_MESSAGES[classification],
    });
  } catch (error) {
    console.error("photo-authenticity failed", error);
    return jsonResponse({ error: "Could not validate this photo right now" }, 502);
  }
});
