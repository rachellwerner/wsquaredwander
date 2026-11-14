// Server function middleware: verifies the caller's Supabase session and gives
// handlers a Supabase client that acts AS that user (RLS applies).
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseFetch, missingEnvError, readEnv } from "./shared";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const key = readEnv("SUPABASE_PUBLISHABLE_KEY") || readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) {
    throw missingEnvError([...(!url ? ["SUPABASE_URL"] : []), ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : [])]);
  }

  const authHeader = getRequest()?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: please sign in again");
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) throw new Error("Unauthorized: invalid token");

  const supabase = createClient(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: please sign in again");

  return next({
    context: {
      supabase,
      userId: data.claims.sub as string,
      email: (data.claims.email as string | undefined) ?? null,
    },
  });
});
