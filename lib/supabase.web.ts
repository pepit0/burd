import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./supabase.env";

const { url, key } = getSupabaseEnv();

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (client) {
    return client;
  }

  if (typeof window === "undefined") {
    throw new Error("Supabase is only available in the browser.");
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getClient();
    const value = instance[prop as keyof SupabaseClient];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});
