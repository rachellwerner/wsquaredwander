import type { SupabaseClient } from "@supabase/supabase-js";

/** Turn a display name or email into a clean inbox handle, e.g. "Rachel Werner" -> "rachel". */
export function deriveHandle(input: {
  fullName?: string | null;
  email?: string | null;
}): string {
  const raw =
    (input.fullName ?? "").trim().split(/\s+/)[0] ||
    (input.email ?? "").split("@")[0] ||
    "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length >= 2 ? cleaned.slice(0, 24) : "";
}

/**
 * Make sure the profile's inbox_code is a name-based handle.
 * Falls back to appending a number when the handle is already taken.
 */
export async function ensureNameInboxCode(
  supabase: SupabaseClient<any>,
  userId: string,
  current: string | undefined,
  desired: string,
): Promise<string> {
  if (!desired) return current ?? "";
  if (current && (current === desired || new RegExp(`^${desired}\\d+$`).test(current))) {
    return current;
  }
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? desired : `${desired}${i + 1}`;
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("inbox_code", candidate)
      .maybeSingle();
    if (taken && taken.id !== userId) continue;
    const { error } = await supabase
      .from("profiles")
      .update({ inbox_code: candidate })
      .eq("id", userId);
    if (!error) return candidate;
  }
  return current ?? "";
}
