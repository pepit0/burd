import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProfileRequest {
  species_id?: string;
  common_name?: string;
  scientific_name?: string;
  family?: string;
}

interface SpeciesProfileRow {
  species_id: string;
  common_name: string;
  scientific_name: string;
  family: string | null;
  size: string;
  habitat: string;
  geographic_range: string;
  diet: string;
  summary: string;
  field_marks: string[];
  author_user_id?: string | null;
}

interface GeneratedProfile {
  size?: string;
  habitat?: string;
  range?: string;
  diet?: string;
  summary?: string;
  field_marks?: unknown;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rowToResponse(row: SpeciesProfileRow): Record<string, unknown> {
  return {
    species_id: row.species_id,
    family: row.family ?? "",
    size: row.size,
    habitat: row.habitat,
    range: row.geographic_range,
    diet: row.diet,
    summary: row.summary,
    field_marks: row.field_marks,
    curated: false,
  };
}

function parseFieldMarks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function parseAnthropicError(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as {
      error?: { type?: string; message?: string };
    };
    const message = parsed.error?.message?.trim();
    if (message) return message;
  } catch {
    // fall through
  }
  return detail.trim().slice(0, 200) || "Anthropic request failed";
}

function parseGeneratedProfile(text: string): GeneratedProfile | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as GeneratedProfile;
  } catch {
    return null;
  }
}

function buildGenerationPrompt(
  commonName: string,
  scientificName: string,
  family: string,
): string {
  return `Write field guide content for the bird species ${commonName} (${scientificName}), family ${family}.

Return ONLY valid JSON with this exact shape (no markdown fences):
{
  "size": "typical length e.g. 9-11 in",
  "habitat": "one concise sentence",
  "range": "one concise sentence on geographic range",
  "diet": "brief diet description",
  "summary": "2-3 friendly sentences for casual birders",
  "field_marks": ["three short identification bullet points"]
}`;
}

async function getFirstPhotoAuthor(
  supabaseAdmin: ReturnType<typeof createClient>,
  commonName: string,
  scientificName: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc(
    "get_species_field_guide_author",
    {
      in_scientific_name: scientificName,
      in_common_name: commonName,
    },
  );

  if (error) {
    console.error("author lookup failed", error);
    return null;
  }

  const row = (data as { user_id?: string }[] | null)?.[0];
  return row?.user_id ?? null;
}

async function userHasPhotoSighting(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  commonName: string,
  scientificName: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("sightings")
    .select("id, species, scientific_name")
    .eq("user_id", userId)
    .not("photo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("sightings read failed", error);
    return false;
  }

  const common = commonName.toLowerCase();
  const scientific = scientificName.toLowerCase();

  return (data ?? []).some((row) => {
    const record = row as {
      species?: string;
      scientific_name?: string | null;
    };
    if (record.scientific_name?.toLowerCase() === scientific) return true;
    return record.species?.toLowerCase() === common;
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: ProfileRequest;
  try {
    body = (await req.json()) as ProfileRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const speciesId = body.species_id?.trim();
  const commonName = body.common_name?.trim();
  const scientificName = body.scientific_name?.trim();
  const family = body.family?.trim() ?? "";

  if (!speciesId || !commonName || !scientificName) {
    return jsonResponse({ error: "Species id and names are required" }, 400);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: cached, error: cacheError } = await supabaseAdmin
    .from("species_profiles")
    .select("*")
    .eq("species_id", speciesId)
    .maybeSingle();

  if (cacheError) {
    console.error("species_profiles read failed", cacheError);
    return jsonResponse({ error: "Could not load profile" }, 502);
  }

  if (cached) {
    return jsonResponse(
      rowToResponse(cached as SpeciesProfileRow),
    );
  }

  const hasPhoto = await userHasPhotoSighting(
    supabaseAdmin,
    user.id,
    commonName,
    scientificName,
  );
  if (!hasPhoto) {
    return jsonResponse(
      {
        error:
          "Log a sighting with a photo of this species before generating the field guide.",
      },
      403,
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Profile generator is not configured" }, 500);
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
        max_tokens: 700,
        system:
          "You are an expert bird field guide writer for a birding app called Burd. Output only valid JSON.",
        messages: [
          {
            role: "user",
            content: buildGenerationPrompt(commonName, scientificName, family),
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text().catch(() => "");
      console.error("Anthropic profile error", anthropicRes.status, detail);
      return jsonResponse(
        {
          error: `Could not generate profile: ${parseAnthropicError(detail)}`,
        },
        502,
      );
    }

    const anthropicData = (await anthropicRes.json()) as {
      content?: { type: string; text?: string }[];
    };
    const rawText = anthropicData.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();

    const generated = rawText ? parseGeneratedProfile(rawText) : null;
    if (!generated) {
      console.error("Invalid profile JSON", rawText?.slice(0, 500));
      return jsonResponse({ error: "Could not parse profile from AI response" }, 502);
    }

    const authorUserId = await getFirstPhotoAuthor(
      supabaseAdmin,
      commonName,
      scientificName,
    );

    const profileRow = {
      species_id: speciesId,
      common_name: commonName,
      scientific_name: scientificName,
      family: family || null,
      size: generated.size?.trim() ?? "",
      habitat: generated.habitat?.trim() ?? "",
      geographic_range: generated.range?.trim() ?? "",
      diet: generated.diet?.trim() ?? "",
      summary: generated.summary?.trim() ?? "",
      field_marks: parseFieldMarks(generated.field_marks),
      author_user_id: authorUserId,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("species_profiles")
      .upsert(profileRow, { onConflict: "species_id" })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("species_profiles insert failed", insertError);
      return jsonResponse(rowToResponse(profileRow as SpeciesProfileRow));
    }

    return jsonResponse(rowToResponse(inserted as SpeciesProfileRow));
  } catch (error) {
    console.error("species-profile failed", error);
    return jsonResponse({ error: "Could not generate profile" }, 502);
  }
});
