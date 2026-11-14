import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Inbound mail webhook.
 *
 * Accepts the CloudMailin JSON format as well as a simple generic shape.
 * Authentication: a shared secret (INBOUND_EMAIL_SECRET) supplied either as
 *   - ?token=<secret> in the webhook URL (CloudMailin style), or
 *   - an x-inbound-token header, or
 *   - an HMAC-SHA256 signature of the raw body in x-inbound-signature.
 */

const cloudMailinSchema = z.object({
  headers: z
    .object({
      subject: z.union([z.string(), z.array(z.string())]).optional(),
      from: z.union([z.string(), z.array(z.string())]).optional(),
      to: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .passthrough()
    .optional(),
  envelope: z
    .object({
      to: z.string().optional(),
      from: z.string().optional(),
      recipients: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
  plain: z.string().optional(),
  html: z.string().optional(),
  // generic / legacy shape
  to: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
});

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function authorized(request: Request, rawBody: string, secret: string) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? request.headers.get("x-inbound-token");
  if (token && safeEqual(token, secret)) return true;

  const signature =
    request.headers.get("x-inbound-signature") ?? request.headers.get("x-webhook-signature");
  if (signature) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqual(signature.replace(/^sha256=/, ""), expected);
  }
  return false;
}

async function readBody(request: Request, rawBody: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return JSON.parse(rawBody) as unknown;
  // CloudMailin "multipart" / form formats and most other providers post form data.
  const params = new URLSearchParams(rawBody);
  const obj: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) obj[key] = value;
  // Providers that post form-encoded JSON blobs (e.g. headers[subject])
  const subject = params.get("headers[subject]") ?? params.get("subject");
  if (subject) obj["subject"] = subject;
  const to = params.get("envelope[to]") ?? params.get("to");
  if (to) obj["to"] = to;
  const from = params.get("envelope[from]") ?? params.get("from");
  if (from) obj["from"] = from;
  return obj;
}

export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INBOUND_EMAIL_SECRET"];
        if (!secret) return new Response("Inbound email not configured", { status: 503 });

        const rawBody = await request.text();
        if (!authorized(request, rawBody, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof cloudMailinSchema>;
        try {
          parsed = cloudMailinSchema.parse(await readBody(request, rawBody));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const recipient =
          parsed.envelope?.to ??
          parsed.envelope?.recipients?.[0] ??
          first(parsed.headers?.to) ??
          parsed.to ??
          "";
        const sender = parsed.envelope?.from ?? first(parsed.headers?.from) ?? parsed.from ?? null;
        const subject = first(parsed.headers?.subject) ?? parsed.subject ?? null;

        // Accept name@domain and legacy trips+code@domain addresses.
        const match = /(?:^|<|\s)(?:[a-z0-9._-]*\+)?([a-z0-9]{2,32})@/i.exec(recipient);
        if (!match) return new Response("Unknown recipient", { status: 202 });
        const inboxCode = match[1]!.toLowerCase();

        const body = (parsed.plain?.trim() || (parsed.html ? stripHtml(parsed.html) : "")).slice(0, 40000);
        if (body.length < 20) return new Response("Nothing to parse", { status: 202 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("inbox_code", inboxCode)
          .maybeSingle();
        if (!profile) return new Response("Unknown recipient", { status: 202 });
        const userId = profile.id as string;

        const { data: email, error: emailError } = await supabaseAdmin
          .from("inbound_emails")
          .insert({
            user_id: userId,
            source: "forward",
            from_email: sender,
            to_email: recipient.slice(0, 320),
            subject: subject?.slice(0, 500) ?? null,
            body,
            status: "pending",
          })
          .select("id")
          .single();
        if (emailError) return new Response("Could not store email", { status: 500 });

        const { extractBookings, getAiKey } = await import("@/lib/email-parse.server");
        const apiKey = getAiKey();
        if (!apiKey) return new Response("ok", { status: 200 });

        try {
          const bookings = await extractBookings(body, apiKey);
          if (bookings.length === 0) {
            await supabaseAdmin
              .from("inbound_emails")
              .update({ status: "unreadable", error: "No bookings found in this email." })
              .eq("id", email.id);
            return new Response("ok", { status: 200 });
          }
          await supabaseAdmin.from("parsed_bookings").insert(
            bookings.map((b) => ({
              user_id: userId,
              email_id: email.id,
              booking: b,
              booking_date: b.date ?? b.checkIn ?? null,
              status: "pending",
            })),
          );
          await supabaseAdmin.from("inbound_emails").update({ status: "parsed" }).eq("id", email.id);
        } catch (err) {
          console.error("inbound parse failed", err);
          await supabaseAdmin
            .from("inbound_emails")
            .update({ status: "unreadable", error: "Could not read this email." })
            .eq("id", email.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
