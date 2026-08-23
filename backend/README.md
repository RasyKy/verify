# Verify — Backend

REST API for certificate issuance, claiming and blockchain-backed verification.
Node 20+ · Express 5 · Supabase · ethers v6 · Polygon.

Owner: Chhay Lyhour.

## Quick start

```bash
npm install
cp .env.example .env      # then fill it in — see the table below
npm run dev               # → http://localhost:3001
curl localhost:3001/api/health
```

`src/config/env.js` validates the whole environment at boot and refuses to start
with a clear list of what is missing, so an incomplete deploy fails immediately
rather than at the first request that needs a variable.

| Script           |                                             |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Watch mode, loads `.env`, Sentry pre-loaded |
| `npm start`      | Production                                  |
| `npm test`       | Jest + Supertest (native ESM)               |
| `npm run lint`   | ESLint 10 flat config                       |
| `npm run format` | Prettier                                    |

## Layout

```
src/
  app.js                  Builds the Express app — NO listen(), so Supertest can import it
  server.js               The only listen() call; graceful SIGTERM drain
  instrument.js           Sentry.init() — loaded via `node --import`, must be first
  config/env.js           Zod-validated environment; fails fast at boot
  config/supabase.js      adminClient (service_role) + anonClient (RLS-bound)
  middleware/             auth · validate · rateLimit · errorHandler · requestLogger
  routes/                 One router per resource
  services/               hash · blockchain · certificate · email · audit
  schemas/                Zod request schemas
  lib/                    logger (PII-redacting) · errors · derivedStatus · cache
  jobs/                   expiryNotifications · reconcilePendingTx
db/migrations/            Numbered SQL — replayable onto a fresh Supabase project
scripts/                  print-hash-vectors · check-supabase · apply-migrations · seed
tests/
```

## Environment

See [.env.example](./.env.example) for the annotated list. The ones that need
explaining:

| Variable               |                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_KEY` | Bypasses RLS. Server-side only, never to the browser                                                                              |
| `SUPABASE_ANON_KEY`    | Public key, for the RLS-bound client                                                                                              |
| `SUPABASE_JWT_SECRET`  | **Leave empty** unless the project uses legacy HS256 signing. Empty means tokens are verified against the project's JWKS endpoint |
| `PRIVATE_KEY`          | Platform relayer wallet with `ISSUER_ROLE`. Railway env vars only (NFR-SEC-01, T-03)                                              |
| `CHAIN_ID`             | `80002` Amoy · `137` mainnet. Checked against the RPC's reported chain ID so a testnet key cannot accidentally sign on mainnet    |

## Database

```bash
db/migrations/0001_init.sql          # enums, tables, indexes, triggers
db/migrations/0002_rls.sql           # RLS: deny-by-default
db/migrations/0003_claim_resend.sql  # audit action for POST …/resend-claim
```

Apply them in order — paste into the Supabase SQL editor, run `supabase db push`,
or use the bundled runner:

```bash
npm run db:check     # are the credentials good, and are the tables there?
SUPABASE_ACCESS_TOKEN=sbp_… npm run db:migrate
npm run db:seed      # development fixtures for Postman
npm run chain:sync   # replay the seeded hashes onto the chain service
```

**`chain:sync` is not optional after a seed.** The seed's blockchain columns are
synthetic, and verification ignores them — it recomputes the hash and asks the
registry. Without this step every fixture verifies as `invalid`. The same script
is the backfill when the real contract is deployed (`--dry-run` first, then
`--yes`).

`db:migrate` needs an **account** access token
([dashboard → account → tokens](https://supabase.com/dashboard/account/tokens)),
not the project service key. DDL cannot go through PostgREST, which only exposes
tables that already exist; the Management API is the path that can create them.

### Seed data

`npm run db:seed` is re-runnable — it removes what the previous run created
before inserting, so there is no duplicate or "already exists" failure. Accounts
all use the password `Password123!`:

| Email                       | Role   | Org   | Why it exists                      |
| --------------------------- | ------ | ----- | ---------------------------------- |
| `admin@example.com`         | admin  | —     | Platform-wide access               |
| `issuer.rupp@example.com`   | issuer | rupp  | Normal issuer                      |
| `issuer.istad@example.com`  | issuer | istad | Second org, for cross-tenant leaks |
| `holder.sophat@example.com` | holder | —     | Claimed certificates               |
| `holder.sophea@example.com` | holder | —     | Name has a precomposed `é` (NFC)   |
| `deactivated@example.com`   | issuer | rupp  | Logs in, then every route must 403 |

Six certificates cover every branch of `derivedStatus.js` — valid, unclaimed,
expired, revoked, plus a hidden one (FR-HOLD-06) and one expiring inside the
60-day window (FR-EXP-03). Their UUIDs are fixed (`30000000-…-00000000000N`) so a
Postman collection can hardcode them across re-seeds.

Hashes are computed by the real `services/hash.js`, so they survive
recomputation on the verification path. Blockchain fields are **synthetic** — the
contract is not deployed and those transactions do not exist on Amoy.

The run writes `db/postman_environment.json` (gitignored, contains a live claim
token). Import it via Postman → Environments → Import.

ER diagram and the reasoning behind the shape:
[docs/er-diagram.md](../docs/er-diagram.md).

RLS is enabled with **no policies** for `anon` or `authenticated`, so neither can
read anything directly. All access goes through this API with the service-role
key. Safe because the frontend's Supabase client is used only for authentication
and never queries a table — and it means a leaked anon key (it ships to every
browser) exposes nothing.

## When a claim email does not arrive

The raw claim token exists in exactly one place — the email carrying it, since
`claim_tokens` stores only its sha256. A delivery failure therefore leaves a
certificate that is valid, on chain and verifiable, but that nobody can ever
claim. `POST /api/certificates/:id/resend-claim` is the way back: it retires the
outstanding token, mints a replacement, and sends it again. Issuers may call it
for their own institution; admins for any.

Outside production the response also carries the live `claim_url`, so the claim
flow can be exercised with no working mail at all — which is the normal state
locally.

### Choosing a transport

`services/email.js` sends through one of two providers, chosen by which
variables are set. SMTP wins when `SMTP_USER` and `SMTP_PASSWORD` are both
present; otherwise Resend, if `RESEND_API_KEY` is set; otherwise email is off
and claim links are logged. Production refuses to boot without one of them.

**Resend needs a verified sending domain.** Without one the only usable sender
is the shared `onboarding@resend.dev`, and that delivers _only_ to the Resend
account owner's own address — every other recipient comes back `403 You can
only send testing emails to your own email address`. Since the sender swallows
provider errors by design, this looks like silence rather than failure: the
certificate issues, `claim_email_sent` is `false`, and the rejection appears
only in the log line `claim email rejected by provider`.

**SMTP is the way around that with no domain.** `SMTP_USER` plus a Google [app
password](https://myaccount.google.com/apppasswords) (2-Step Verification must
be on) authenticates as a Gmail account and sends as it, so SPF and DKIM align
and any recipient receives the mail — roughly 500/day. `smtpAdapter` wraps
nodemailer in the Resend SDK's `{ emails: { send } } → { data, error }` shape,
so both senders stay provider-agnostic and one set of error handling covers
both. Note that Gmail rewrites the From address to the authenticated account
unless it is a verified "send mail as" alias, which is why only the display
name (`MAIL_FROM_NAME`) is configurable under SMTP.

**The Resend SDK never throws.** `emails.send()` reports a refused message
through `{ data, error }`, so a bare `await` in a try/catch sees only the happy
path and reports success for mail the provider rejected outright.
`services/email.js` reads `error` explicitly; anything new that sends mail must
do the same. nodemailer has the opposite convention — it throws, and it also
_resolves_ for a per-recipient refusal — so `smtpAdapter` translates both into
the same `error` object rather than letting either be read as a delivery.

## Auth email templates

Password reset and certificate claim both work by **typed code**, not by clicked
link — the frontend renders an 8-box pin input and calls `verifyOtp`. Supabase
always mints that code, but its stock email templates render only
`{{ .ConfirmationURL }}`, so the mail arrives with a link and no digits and the
flow dead-ends with nothing to type. The templates are project settings, so a
fresh project starts out broken this way.

```bash
SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates            # report only
SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write # fix them
```

That covers **Reset Password**, **Magic Link** and **Confirm signup**, and each
one is deliberately code-only: `{{ .Token }}` and the token inside
`{{ .ConfirmationURL }}` are the same one-time token, so a mail scanner that
prefetches the link spends the code the user is still typing.

Two settings the script reports but does not change, both under Authentication →
Sign In / Providers → Email: **Email OTP Length** must stay `8` to match
`OTP_LENGTH` in `frontend/app/composables/useOtp.ts`, and Email OTP Expiration
drives the "expires in one hour" line in the templates.

## Six things that will surprise you

**1. This API never mints tokens.** The Nuxt app signs in directly against
Supabase Auth; `middleware/auth.js` only verifies the resulting JWT.
Re-implementing token refresh in Express would be a weaker copy of what
supabase-js already does.

`/api/auth/login` and `/api/auth/refresh` do exist, but they **delegate** to
Supabase Auth rather than signing anything themselves — a second, equivalent path
for non-browser clients and Postman. Both mint the same Supabase JWT the browser
flow does, verified by the same middleware.

**2. JWT verification is local.** Against the project's JWKS (cached in-process),
or HS256 if `SUPABASE_JWT_SECRET` is set. Calling `supabase.auth.getUser()` per
request — as the original code did — costs a network round-trip on every API call
and takes the whole API down whenever Supabase's auth endpoint is slow.

**3. Role comes from `app_metadata`, then from `profiles`.** `user_metadata` is
writable by the user, so reading a role from it would let any holder promote
themselves to admin. `profiles` is the source of truth and is re-read (60s cache)
because `app_metadata` only reaches a token on its next refresh.

**4. Status is never stored.** Derived on read from `claim_state`, `revoked_at`
and `expiry_date` ([lib/derivedStatus.js](./src/lib/derivedStatus.js)) — so a
certificate becomes `expired` the day after its expiry date with no job running.
Two vocabularies, both derived, because the frontend uses different unions for
the issuer table and the verify page.

**5. Casing is asymmetric on purpose.** Issuer-list responses are snake_case;
request bodies and the verify response are camelCase. That is what the existing
frontend components destructure. See [docs/api-schema.md](../docs/api-schema.md).

**6. `req.validated`, not `req.body`.** Express 5 made `req.query` a getter with
no setter, so validated output goes to `req.validated.{body,query,params}`.
Handlers must read from there — it is also the coerced, defaulted copy.

## Testing

Jest 30 running native ESM, no Babel: what the tests exercise is what ships. Two
consequences:

- `npm test` sets `NODE_OPTIONS=--experimental-vm-modules` (still required).
- **`jest.mock()` does not work under ESM.** Rather than reach for
  `unstable_mockModule`, services are injected into route factories so tests pass
  plain fakes. Also import `{ jest }` from `@jest/globals` — it is not a global
  in ESM.

```bash
npm test
node scripts/print-hash-vectors.js   # the cross-language hash contract
```

The suite that matters most is `tests/hash.test.js`. A regression there does not
throw — it silently reports genuine certificates as forged.

## Docs

|                                                        |                                            |
| ------------------------------------------------------ | ------------------------------------------ |
| [api-schema.md](../docs/api-schema.md)                 | Endpoint contract                          |
| [er-diagram.md](../docs/er-diagram.md)                 | Schema + design reasoning                  |
| [user-flows.md](../docs/user-flows.md)                 | Issue → claim → verify → revoke → expire   |
| [hash-spec.md](../docs/hash-spec.md)                   | Hash contract + fixed vectors (blockchain) |
| [frontend-handshake.md](../docs/frontend-handshake.md) | What the Nuxt app needs to change          |
| [stride-checklist.md](../docs/stride-checklist.md)     | Mainnet gate                               |
