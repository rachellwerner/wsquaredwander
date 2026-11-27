import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Only the admin can manage users.");
}

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        memberId: z.string().uuid(),
        redirectTo: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: member, error } = await context.supabase
      .from("members")
      .select("id,email,name")
      .eq("id", data.memberId)
      .single();
    if (error) throw new Error(error.message);
    if (!member.email) throw new Error("Add an email for this person before inviting them.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(member.email, {
      redirectTo: data.redirectTo,
      data: { full_name: member.name },
    });

    let mode: "invite" | "reset" = "invite";
    if (inviteError) {
      const msg = inviteError.message ?? "";
      if (!/already been registered|already exists/i.test(msg)) {
        throw new Error(msg || "Could not send that invitation.");
      }
      // They already have an account: send a link to (re)set their password instead.
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(member.email, {
        redirectTo: data.redirectTo,
      });
      if (resetError) throw new Error(resetError.message || "Could not send a password link.");
      mode = "reset";
    }

    await context.supabase
      .from("members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", member.id);

    return { ok: true, email: member.email as string, mode };
  });
