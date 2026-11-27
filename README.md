# W²ander — family trip planner

Private, invite-only family itineraries: day-by-day bookings, who's going,
maps, a Today view for while you're traveling, and votes on plans.

Stack: TanStack Start (React) · Supabase (database + logins) · Vercel (hosting) ·
Claude API (reading confirmation emails) · OpenStreetMap (maps).

## Who can do what

| | Admin (Rachel) | Traveler, *can edit* | Traveler, view only |
|---|---|---|---|
| See trips | all | trips they're on | trips they're on |
| Add / change bookings | ✓ | ✓ | — |
| Start / close votes | ✓ | ✓ | — |
| Vote | ✓ | ✓ | ✓ |
| Create / delete trips, add people, invite | ✓ | — | — |
| Email inbox | ✓ | — | — |

These rules are enforced by the database itself (row-level security in
`supabase/setup.sql`), not just hidden in the UI.

## One-time setup

1. **Supabase → SQL Editor → New query**: paste all of `supabase/setup.sql`, Run.
2. **Supabase → Authentication → Users → Add user → Create new user**: your
   email + a password, tick *Auto confirm*. You become admin automatically.
3. **Supabase → Authentication → Sign In / Providers**: turn **off**
   "Allow new users to sign up" (invites still work).
4. **Supabase → Authentication → URL Configuration**: Site URL =
   your site (e.g. `https://wsquaredwander.com`); add Redirect URLs
   `https://wsquaredwander.com/**` and your `https://<project>.vercel.app/**`.
5. **Vercel → New Project → import this GitHub repo**, add the environment
   variables from `.env.example`, Deploy.

## Environment variables

See `.env.example`. `VITE_*` values are public (they ship to the browser).
`SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` are secret — only ever set them
in Vercel, never commit them.

## Email forwarding (confirmation emails → Inbox)

Forward a booking confirmation to `yourname@wsquaredwander.com` (shown on the Inbox page) and it appears in your Inbox to review and add to a trip. Only mail from someone on the People page is processed.

1. Resend → Domains → wsquaredwander.com: turn on receiving and add its MX record at the domain's DNS.
2. Resend → Webhooks: add `https://wsquaredwander.com/api/public/inbound-email` for the `email.received` event.
3. Vercel → Settings → Environment Variables: `INBOUND_EMAIL_DOMAIN` = `wsquaredwander.com`, `RESEND_WEBHOOK_SECRET` (the webhook's signing secret), `RESEND_API_KEY` (a full-access Resend key, used to read received mail). Then redeploy.

## Local development

```bash
npm install
cp .env.example .env   # fill in values
npm run dev            # http://localhost:3000
```
