// Shared helpers for creating Supabase clients (browser + server).

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * New-style Supabase keys (sb_publishable_ / sb_secret_) are not JWTs, so they
 * must be sent as `apikey` only — never as a Bearer token.
 */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

export function missingEnvError(names: string[]) {
  const message = `Missing environment variable(s): ${names.join(", ")}. Add them in Vercel → Project → Settings → Environment Variables.`;
  console.error(`[Supabase] ${message}`);
  return new Error(message);
}
