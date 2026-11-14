// Browser + SSR Supabase client (uses the public/publishable key; RLS applies).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseFetch, missingEnvError, readEnv } from "./shared";

function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env["VITE_SUPABASE_URL"] || readEnv("SUPABASE_URL");
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || readEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) {
    throw missingEnvError([
      ...(!url ? ["VITE_SUPABASE_URL"] : []),
      ...(!key ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ]);
  }
  const isBrowser = typeof window !== "undefined";
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: {
      storage: isBrowser ? window.localStorage : undefined,
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  });
}

let _supabase: SupabaseClient | undefined;

// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
