import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const parsePastedConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        text: z.string().min(20).max(40000),
        subject: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { extractBookings, getAiKey } = await import("./email-parse.server");
    const apiKey = getAiKey();
    if (!apiKey) throw new Error("Email reading isn't set up yet — add ANTHROPIC_API_KEY in Vercel.");

    const { data: email, error: emailError } = await context.supabase
      .from("inbound_emails")
      .insert({
        user_id: context.userId,
        source: "paste",
        subject: data.subject ?? null,
        body: data.text,
        status: "pending",
      })
      .select("id")
      .single();
    if (emailError) throw new Error(emailError.message);

    try {
      const bookings = await extractBookings(data.text, apiKey);
      if (bookings.length === 0) {
        await context.supabase
          .from("inbound_emails")
          .update({ status: "unreadable", error: "No bookings found in this text." })
          .eq("id", email.id);
        return { emailId: email.id as string, count: 0 };
      }
      const rows = bookings.map((b) => ({
        user_id: context.userId,
        email_id: email.id,
        booking: b,
        booking_date: b.date ?? b.checkIn ?? null,
        status: "pending",
      }));
      const { error: insertError } = await context.supabase.from("parsed_bookings").insert(rows);
      if (insertError) throw new Error(insertError.message);
      await context.supabase.from("inbound_emails").update({ status: "parsed" }).eq("id", email.id);
      return { emailId: email.id as string, count: bookings.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read that confirmation.";
      await context.supabase
        .from("inbound_emails")
        .update({ status: "unreadable", error: message })
        .eq("id", email.id);
      throw new Error(message);
    }
  });

export const getForwardingAddress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domain = process.env["INBOUND_EMAIL_DOMAIN"] ?? null;
    const { data, error } = await context.supabase
      .from("profiles")
      .select("inbox_code")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    let code = data?.inbox_code as string | undefined;
    if (!code) {
      const { data: created, error: createError } = await context.supabase
        .from("profiles")
        .insert({ id: context.userId })
        .select("inbox_code")
        .single();
      if (createError) throw new Error(createError.message);
      code = created.inbox_code as string;
    }

    const { deriveHandle, ensureNameInboxCode } = await import("./inbox-name.server");
    const { data: me } = await context.supabase
      .from("members")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const desired = deriveHandle({ fullName: (me?.name as string | undefined) ?? null, email: context.email });
    code = (await ensureNameInboxCode(context.supabase, context.userId, code, desired)) || code;

    return {
      code,
      address: domain ? `${code}@${domain}` : null,
    };
  });