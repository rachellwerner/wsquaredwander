# Notes for coding assistants

- TanStack Start app; file-based routes in `src/routes/` (see `src/routes/README.md`).
  `src/routeTree.gen.ts` is generated at build/dev time — don't edit it.
- Database schema + permissions live in `supabase/setup.sql`. Permissions are
  enforced with row-level security; keep UI checks in sync with the policies.
- Bookings are stored as JSON on `trips.activities`; `who` holds member ids.
- Server-only secrets: `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`,
  `INBOUND_EMAIL_SECRET`. Only read them in `*.server.ts` files or inside
  server function handlers.
- Hosted on Vercel; `main` deploys automatically.
