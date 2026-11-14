// Server-only Supabase client with the secret key — BYPASSES row-level security.
// Only import inside server handlers:
//   const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseFetch, missingEnvError, readEnv } from "./shared";

function createSupabaseAdminClient(): SupabaseClient {
  const url = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const key = readEnv("SUPABASE_SECRET_KEY") || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw missingEnvError([...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_SECRET_KEY"] : [])]);
  }
  return createClient(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _supabaseAdmin: SupabaseClient | undefined;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
