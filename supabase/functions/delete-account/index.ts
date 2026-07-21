import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BUCKETS = ["avatars", "sightings", "sound_clips"] as const;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteUserStorageFolder(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<void> {
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(userId, {
      limit,
      offset,
    });
    if (error) {
      throw new Error(`Failed to list ${bucket}/${userId}: ${error.message}`);
    }

    const filePaths = (data ?? [])
      .filter((item) => item.name && item.id)
      .map((item) => `${userId}/${item.name}`);

    if (filePaths.length > 0) {
      const { error: removeError } = await admin.storage.from(bucket).remove(
        filePaths,
      );
      if (removeError) {
        throw new Error(
          `Failed to delete ${bucket} files: ${removeError.message}`,
        );
      }
    }

    if (!data || data.length < limit) break;
    offset += limit;
  }
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

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    for (const bucket of STORAGE_BUCKETS) {
      await deleteUserStorageFolder(admin, bucket, user.id);
    }
  } catch (storageError) {
    const message = storageError instanceof Error
      ? storageError.message
      : "Storage cleanup failed";
    return jsonResponse({ error: message }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ ok: true });
});
