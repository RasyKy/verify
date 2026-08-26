# Deployment

Two services, two platforms:

| | Platform | Root directory | Entry |
| --- | --- | --- | --- |
| Nuxt app | Vercel | `frontend` | Nitro's `vercel` preset (auto-detected) |
| Express API | Render (Web Service) | `backend` | `npm start` |

Supabase and Polygon Amoy are shared by both. `blockchain/deployments/amoy.json`
is the source of truth for the deployed contract; mainnet is gated on
[stride-checklist.md](./stride-checklist.md).

---

## The thing that breaks every first deploy

Three separate places hold "where does the frontend live", and **none of them
default to your production domain**:

1. `FRONTEND_URL` on Render → builds claim links and certificate QR payloads,
   and is the CORS allowlist.
2. Supabase **Site URL** → where Auth sends anyone whose `redirectTo` is not
   allowlisted. This is what makes a production link land on `localhost:3000`.
3. `NUXT_PUBLIC_API_BASE` on Vercel → where the browser looks for the API.

Miss (1) and the app still boots — it just emails students links to their own
machine. That silence is why `src/config/env.js` now **refuses to start** in
production when `FRONTEND_URL` is localhost or non-https. Miss (2) and OAuth
bounces to localhost with no error anywhere. Miss (3) and every page renders
fine, then fails on its first API call.

---

## 1. Render — the API

Web Service, connected to this repo. `render.yaml` at the repo root declares it;
the settings it encodes are:

- **Root directory** `backend`
- **Build** `npm ci` · **Start** `npm start`
- **Health check path** `/api/health` — mounted before the rate limiter in
  `src/app.js`, so probes can never be throttled into a false unhealthy

Environment variables (`sync: false` in the blueprint means Render prompts for
them; nothing secret is committed):

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | the Vercel production origin, https. Comma-separate to allow more |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY` | from the Supabase project |
| `SUPABASE_JWT_SECRET` | legacy HS256 projects only — leave empty for asymmetric keys |
| `ALCHEMY_RPC_URL` / `PRIVATE_KEY` / `CONTRACT_ADDRESS` | Amoy RPC + relayer wallet + `0x46Cc4B537fd6B74650A21B6f5f82FE8146Fb0F66` |
| `CHAIN_ID` | `80002` (Amoy). Checked against the RPC's reported chain ID at boot |
| email | `SMTP_HOST`/`SMTP_PORT` (pinned to Brevo's relay), `SMTP_USER` + `SMTP_PASSWORD` (Brevo login/key), `SMTP_FROM_EMAIL` (verified Brevo sender) — **or** `RESEND_API_KEY` + `RESEND_FROM_EMAIL` |
| `SENTRY_DSN`, `LOG_LEVEL` | optional; `LOG_LEVEL=info` |

`PORT` is injected by Render — do not pin it. `trust proxy` is already `1` in
`src/app.js`, the correct hop count behind Render's edge, and required for rate
limiting to bucket per client rather than globally (T-04).

> **Free instances spin down when idle.** The `node-cron` expiry sweep in
> `src/server.js` (FR-EXP-03) will not fire on a sleeping service. It needs a
> paid instance or a separate Render Cron Job.

## 2. Vercel — the Nuxt app

- **Root Directory** must be `frontend`. This is a polyrepo; the repo root has
  no `package.json` for Nuxt and the build will not find one.
- Nitro auto-detects the `vercel` preset from Vercel's own `VERCEL` env var —
  no preset pin is needed. `frontend/vercel.json` only fixes the framework and
  pins `npm ci` so builds resolve against the committed lockfile.
- The app is **SSR, not static**. `@nuxtjs/supabase` reads the session cookie
  server-side (see `useApi.ts`), so a static export breaks every portal route.

Environment variables, set for **Production and Preview** — `@nuxtjs/supabase`
throws at *build* time without the first two:

| Variable | Value |
| --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | the Supabase project URL |
| `NUXT_PUBLIC_SUPABASE_KEY` | the **anon/publishable** key — never the service key, which bypasses RLS (T-06) |
| `NUXT_PUBLIC_API_BASE` | the Render service URL, e.g. `https://verify-api.onrender.com` |
| `NUXT_PUBLIC_SENTRY_DSN` | optional; the frontend's Sentry project DSN. Unlike the backend's `SENTRY_DSN` this one is meant to be public — it only accepts events, never exposes data |

## 3. Supabase — the settings that do not live in this repo

**Authentication → URL Configuration**

- **Site URL** → the Vercel production origin.
- **Redirect URLs** → `https://<prod-domain>/**`. Add
  `https://*-<team>.vercel.app/**` if preview deploys must work.
  Required by the Google OAuth path on the claim page, which passes
  `redirectTo: ${window.location.origin}/claim/${token}`. When that origin is
  not allowlisted, Supabase substitutes the Site URL **silently** — this is the
  localhost bounce.

**Google Cloud console** (for the OAuth provider)

- Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origin: the production domain

**Authentication → Email templates** — run against the *production* project:

```
cd backend
npm run auth:templates:preview                              # look at the design, no network
SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates          # report what the project has
SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write
```

Templates are project settings and do not travel with the repo, so a fresh
project starts broken. The reset, magic-link and confirmation mails must render
`{{ .Token }}`; the stock templates carry only a link, which leaves the code
inputs on `/auth/forgot-password` and `/claim/:token` with nothing to accept.

The templates carry a `<!--verify-email:vN-->` marker and the script compares
against it, so a design change is a version bump in
`scripts/set-auth-email-templates.js` plus a re-run — not a one-shot that can
never be updated once a project has *some* code-bearing template.

Until that has been run, the code exists and is valid but no email carries it,
so the reset and claim flows cannot be tested at all. For local work,
`npm run auth:otp -- someone@example.com` prints the code Supabase would have
sent, using the service key rather than a management token. It mints a fresh
code and supersedes any outstanding one, and it is a development tool only —
the fix for a deployed project is the templates.

**Authentication → Sign In / Providers → Email → Email OTP Length** must be
**8**, matching `OTP_LENGTH` in `frontend/app/composables/useOtp.ts`. A mismatch
renders a pin input the code physically cannot fit into, and nothing errors.
`npm run auth:templates` reports the current value.

**Database** — apply migrations against the production project:

```
cd backend && npm run db:migrate
```

---

## Why auth uses typed codes, not links

Both the password reset and the claim sign-in confirm with an 8-digit code. This
is deliberate and the deployment depends on understanding it:

- `@nuxtjs/supabase` defaults `useSsrCookies: true`, so the client comes from
  `@supabase/ssr`'s `createBrowserClient`, which hardcodes `flowType: 'pkce'`.
  A PKCE link is redeemable **only in the browser that requested it** — the code
  verifier lives in that browser's storage. Requesting on a laptop and opening
  the mail on a phone cannot work by construction.
- Corporate mail filters and webmail previews fetch links before a human clicks,
  spending the one-time token.
- A code never touches the redirect allowlist, so it cannot bounce to the Site
  URL.

`/auth/set-password` still exists for links that do arrive, and hands anyone
whose link came in dead over to the code flow.

Issuer invites work the same way: `POST /admin/users` creates the account with a
throwaway password nobody sees, then emails a link to
`/auth/forgot-password?email=…`. That URL carries **no secret**, so a mail
scanner following it burns nothing. If the API has no email transport
configured, the response's `inviteEmailSent: false` makes the admin UI say so
rather than imply mail went out.

---

## Post-deploy smoke test

The checks below only fail in production — they all pass locally.

1. `GET https://<api>/api/health` → `{"status":"ok","chainId":80002,…}`.
2. Sign in on the deployed domain. If the portal loads but data does not,
   `NUXT_PUBLIC_API_BASE` is wrong or the origin is missing from `FRONTEND_URL`
   (the API logs `CORS origin rejected` with the origin it saw).
3. **Reset a password with the request made on a laptop and the code typed on a
   phone.** This is the case link-based resets cannot serve.
4. Claim a certificate via **Google** → it must return to
   `https://<prod-domain>/claim/…`. Landing on localhost means the Redirect URLs
   allowlist is missing the production origin.
5. Issue a certificate → the claim email link *and* the QR payload must both
   carry the production origin. Both come from `FRONTEND_URL`.
6. Invite an issuer → the invite email arrives and its link prefills the address
   on the reset page.
