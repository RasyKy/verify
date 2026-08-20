# Verify Backend — Progress Summary & Guide

**Owner:** Chhay Lyhour (backend) · **Last updated:** 2026-07-27

This is the "where are we and why" document. It summarises what the backend
does so far, explains the handful of ideas that the whole design rests on, and
tells you exactly what to do next. If you read one doc, read this one — the
others ([api-schema](./api-schema.md), [hash-spec](./hash-spec.md),
[er-diagram](./er-diagram.md), [user-flows](./user-flows.md),
[stride-checklist](./stride-checklist.md), [frontend-handshake](./frontend-handshake.md))
go deeper on single topics.

---

## 1. The picture in one paragraph

Verify issues tamper-proof digital certificates. An institution fills in a
student's details; the backend turns those details into a **fingerprint (a
hash)** and records that fingerprint on the **Polygon blockchain** — a public
ledger nobody can secretly edit. The real certificate data lives in **Supabase**
(a hosted PostgreSQL database). To verify a certificate later, the backend
re-computes the fingerprint from the stored data and checks it against the
blockchain: if they match, the certificate is genuine; if a single character was
changed, the fingerprints differ and it shows as invalid. Your backend is the
**REST API** that sits between the Nuxt frontend, Supabase, and the blockchain.

---

## 2. Where we are right now

| Area | Status |
| --- | --- |
| Backend skeleton (server, config, middleware, error handling, logging) | ✅ Built & tested |
| Repo hygiene, CI pipeline, linting, tests | ✅ Built (196 tests passing, 0 vulnerabilities) |
| Database schema (SQL migrations + security rules) | ✅ Written **and applied** — all 9 tables live |
| Hashing (the tamper-detection core) | ✅ Built & tested, with fixed vectors for the blockchain teammate |
| Blockchain service (talks to the smart contract) | ✅ Built — real + **file-backed** stub, wired to the merged `Verifier.sol` |
| Authentication (login, logout, refresh, me, account-exists) | ✅ Built & tested end to end against the real project |
| Connection to your Supabase project | ✅ Connected — setup complete (§6) |
| Development seed data | ✅ `npm run db:seed` — 6 accounts, 6 certificates, Postman environment |
| Certificates: issue, list, get, edit, revoke, QR, public verify | ✅ Built & tested |
| Courses + issuer dashboard | ✅ Built |
| Admin: create organization, create issuer | ✅ Built (the rest of the admin portal is not) |
| **Frontend ↔ backend integration** (issuer portal + public verify) | ✅ Wired — no longer mock data |
| Claim flow · holder/recipient · rest of admin · public registry | ⛔ Not built yet (§7) |

**Plain version:** the demo path works end to end in a browser — an admin creates
an institution and an issuer, that issuer signs in and issues a certificate, the
public verify page says **Verified**, editing a field directly in the database
makes it say **Invalid**, and revoking makes it say **Revoked**. What remains is
the claim flow, the recipient dashboard, and the rest of the admin portal.

### Two things worth knowing about how this was made to work without the chain

**The stub ledger is now a file.** It used to be an in-memory `Map`, which meant
every restart wiped it — and because `npm run dev` runs under `--watch`, that
happened on every file save. Certificates issued before a restart then verified
as `invalid`, which is the single worst output this system can produce, arrived
at by accident. It now persists to `backend/.stub-chain.json` (gitignored), so it
behaves like a chain: it does not forget.

**Seeded certificates need `npm run chain:sync`.** The seed writes *synthetic*
blockchain columns — those transactions never happened. Verification does not
read those columns; it recomputes the hash and asks the registry. So a freshly
seeded database verifies every fixture as `invalid` until the hashes actually
exist somewhere. `scripts/sync-chain-ledger.js` replays
`certificate_hashes` onto whatever chain service is active. Run it after every
seed. **The same script is the mainnet backfill** — after `Verifier.sol` is
deployed, it replays everything issued during stub mode onto the real contract.

---

## 3. How the backend is organised

Everything lives under [`backend/src/`](../backend/src/). Each folder has one job:

```
src/
  server.js        Starts the app and listens on a port. The only file that "runs".
  app.js           Assembles the Express app (routes + middleware). No port — so tests can import it.
  instrument.js    Starts error monitoring (Sentry) before anything else loads.

  config/
    env.js         Reads & validates every environment variable at startup. Refuses to boot if one is wrong.
    supabase.js    Creates the database clients (admin = full access; auth = for login).

  middleware/      Code that runs on every request, in order:
    requestLogger.js  Gives each request an ID and logs it.
    auth.js           Checks the login token, figures out who you are and what you may do (RBAC).
    validate.js       Checks the request body/query with Zod before any logic runs.
    rateLimit.js      Blocks floods of requests.
    errorHandler.js   Turns any error into a safe JSON response (never leaks internals).

  routes/          The actual URL endpoints:
    health.js      GET /api/health  (is the server up?)
    auth.js        login / logout / refresh / me / account-exists

  services/        The "how" behind the routes:
    hash.js        Turns certificate data into a fingerprint (THE most important file).
    blockchain.js  Sends the fingerprint to the blockchain and reads it back.

  schemas/         Zod rules describing what a valid request looks like.
  lib/             Small shared helpers: logger, errors, cache, status-derivation.
  blockchain/abi/  The smart contract's "interface description" (ABI) so we can call it.

db/migrations/     SQL files that create the database tables. Run these on Supabase.
tests/             152 automated tests. Run with `npm test`.
scripts/           Handy tools (e.g. check-supabase.js — "is my DB set up?").
```

---

## 4. The six ideas that explain the whole design

This is the "help me understand" part. Almost every decision in the code traces
back to one of these.

### ① The backend *verifies* logins — it does not *create* them

You might expect the backend to have a "login" that checks passwords and hands
out tokens. It mostly doesn't. **Supabase Auth** is the thing that actually
checks passwords and issues the login token (a **JWT**). The frontend talks to
Supabase directly for that. Your backend's job is to **verify** the token that
arrives on each request and decide what that user is allowed to do.

- *Why:* Supabase already does password hashing, token refresh, and session
  security correctly. Re-building that ourselves would be a weaker copy.
- *We did add* thin `POST /api/auth/login` / `refresh` / `logout` endpoints too —
  they just forward to Supabase. They exist so you can log in from **Postman**
  (to get a token for testing) and because the project brief lists them.
- Verification happens **locally** using Supabase's public keys — no network
  call per request — so it stays fast even under load.
- File: [`middleware/auth.js`](../backend/src/middleware/auth.js).

### ② Your role comes from a place you can't tamper with

Supabase stores two bags of data on each user: `user_metadata` (the user can
edit this) and `app_metadata` (only the server can edit it). Your **role**
(admin / issuer / holder) lives in `app_metadata`, and the backend double-checks
it against the `profiles` table.

- *Why:* if we trusted `user_metadata`, any student could edit their own record
  and make themselves an admin. This is threat **T-01** in the security model.

### ③ A certificate's status is *calculated*, never *stored*

The database does **not** have a "status" column saying valid/revoked/expired.
Instead, status is worked out fresh every time it's read, from three facts:
was it revoked? has its expiry date passed? has it been claimed?

- *Why:* if status were stored, a certificate that expired yesterday would still
  say "valid" until some job updated it. Calculating it means it's always
  correct. File: [`lib/derivedStatus.js`](../backend/src/lib/derivedStatus.js).
- Subtlety: the issuer table and the public verify page use **different words**
  for status (e.g. the issuer sees `valid`, the verifier sees `verified`), so we
  compute both from the same facts.

### ④ The hash *is* the product

A hash is a one-way fingerprint: feed in the exact certificate details, get a
64-character code out. Change one letter of the name and the code is completely
different. We store that code on the blockchain. To verify, we re-hash the
stored details and compare.

- *Why it must be exact:* the backend (JavaScript) and the smart contract
  (Solidity) must produce the **identical** code from the same data. If they
  disagree by one byte, real certificates would show as fake. So the recipe is
  pinned down precisely — field order, spacing, how a missing expiry date is
  written — in [`hash-spec.md`](./hash-spec.md), and locked in by tests with
  known example values. File: [`services/hash.js`](../backend/src/services/hash.js).
- We deliberately **don't** hash the student's email (it's contact info that
  might change, not part of the credential).

### ⑤ The database is locked by default; only the backend has the key

Supabase can be queried directly from a browser using a "public" key. We turned
on **Row Level Security (RLS)** with *no permissions* for that public key — so a
leaked public key reveals **nothing**. All real data access goes through the
backend using a **service key** that bypasses those locks.

- *Why:* the public key ships to every visitor's browser, so assume it leaks.
  Student names and emails must stay protected regardless (threat **T-06**).
- Files: [`db/migrations/0002_rls.sql`](../backend/db/migrations/0002_rls.sql),
  [`config/supabase.js`](../backend/src/config/supabase.js).

### ⑥ We can build against the blockchain before it exists

Talking to a real blockchain needs a deployed contract and a funded wallet. To
avoid waiting, the blockchain service has **two interchangeable versions**: the
real one (ethers.js → Polygon) and an **in-memory stub** that behaves the same
but stores everything in a plain map. When the blockchain settings aren't in
`.env`, the backend automatically uses the stub.

- *Why:* it means the entire issue → verify → revoke flow can be developed and
  tested locally today, and swaps to the real chain by just filling in `.env`.
- File: [`services/blockchain.js`](../backend/src/services/blockchain.js).

*(Two smaller conventions you'll notice in the code: request responses are
`snake_case` for lists but `camelCase` for the verify page — matching what the
frontend already expects rather than "fixing" it; and validated input is read
from `req.validated`, because Express 5 makes `req.query` read-only.)*

---

## 5. What's actually callable today

| Endpoint | Auth | What it does |
| --- | --- | --- |
| `GET /api/health` | public | Is the server up? Returns status + which network it targets. |
| `POST /api/auth/login` | public | Email + password → returns access token + refresh token. |
| `POST /api/auth/refresh` | public | Refresh token → new access token. |
| `POST /api/auth/logout` | logged-in | Revokes the session server-side. |
| `GET /api/auth/me` | logged-in | Who am I? Returns role, organization and `fullName`. |
| `GET /api/auth/account-exists` | public | Does an account exist for this email? (used by the claim page). |
| `GET /api/certificates` | issuer | The organization's certificates, snake_case, status derived. |
| `POST /api/certificates` | issuer | Issue one. Hash → chain → database, in that order. |
| `GET /api/certificates/:id` | issuer | One certificate, org-scoped. |
| `PUT /api/certificates/:id` | issuer | "Edit" = revoke the old hash, issue a new one, same UUID. |
| `POST /api/certificates/:id/revoke` | issuer | Revoke on chain and in the database. |
| `GET /api/certificates/verify/:certId` | **public** | The verification everything else exists to serve. |
| `GET /api/certificates/:id/qr` | **public** | PNG (or `?format=svg`) of the verify URL. |
| `GET` `POST /api/courses` | issuer | Typeahead list; `POST` is idempotent per organization. |
| `GET /api/dashboard?range=` | issuer | Stats, zero-filled chart series, recent activity. |
| `GET` `POST /api/admin/organizations` | admin | List / register an institution. |
| `GET` `POST /api/admin/users` | admin | List accounts / create an issuer (FR-AUTH-01). |

Covered by automated tests that run without touching the network or needing
credentials — the routers take injected fakes, because `jest.mock()` does not
work under this project's native-ESM Jest.

Every mutation above writes an `audit_events` row. That is the whole of T-08:
the chain proves what happened to a hash, the audit log proves who asked for it.

---

## 6. Supabase setup — done

All three steps that used to live here are complete. What was done, so a fresh
clone or a second environment can be brought up the same way:

1. **Project URL** — `SUPABASE_URL` had a stray `/rest/v1/` suffix. `env.js`
   auto-corrects and warns, but the file now holds the bare origin.

2. **Anon key** — `SUPABASE_ANON_KEY` is set to the project's
   `sb_publishable_…` key. This matters: without it `getAuthClient()` falls back
   to the **service key** for logins, which bypasses RLS and is exactly what
   `config/supabase.js` warns against.

3. **Tables created** — `0001_init.sql` and `0002_rls.sql` are applied. Verified
   beyond "the tables exist": RLS is on across all 9 with **zero policies**, and
   a read with the publishable key returns `42501 permission denied`. A leaked
   browser key gets nothing, which is the T-06 posture actually holding.

```bash
cd backend
npm run db:check                              # all 9 tables present
SUPABASE_ACCESS_TOKEN=sbp_… npm run db:migrate  # only on a fresh project
npm run db:seed                               # development fixtures
```

`db:migrate` needs an **account** access token, not the project service key —
DDL cannot go through PostgREST, which only exposes tables that already exist.

### Testing it in Postman

`npm run db:seed` creates six accounts (password `Password123!`) and six
certificates covering every derived status, then writes
`backend/db/postman_environment.json` — import that under Postman →
Environments. Then `POST /api/auth/login` → copy `accessToken` → `GET
/api/auth/me` with `Authorization: Bearer <token>`.

Worth trying: log in as `deactivated@example.com`. The login **succeeds**, then
every protected route returns 403 — that's `middleware/auth.js` reading role and
status from `profiles` rather than trusting the JWT, so a deactivation takes
effect immediately instead of waiting for the token to refresh.

---

## 7. What's left to build (roadmap)

Grouped roughly in the order it makes sense to build. The first three groups are
done; what follows is what is left.

- **Claim flow:** `GET /api/claim/:token/preview` and
  `POST /api/claim/:token/confirm`. Note the design decision: the **frontend's**
  shape wins over the one written in [api-schema.md](./api-schema.md).
  `pages/claim/[token].vue` already creates the Supabase account client-side
  (Google OAuth, email OTP, or password) and then calls confirm with a bearer
  token, so `/confirm` requires auth and asserts the JWT's email matches
  `claim_tokens.sent_to` before burning the token. The doc's
  `POST /api/claims/:token/accept` with `{ password }` would mean deleting two
  working sign-up methods. Preview returns a flat
  `{ valid, expired, used, … }` at HTTP 200 for every case, because the page
  branches on those booleans and status codes would collapse three distinct
  screens into one error state.
  Issuance already creates the `claim_tokens` row, so the links exist.
- **Holder/recipient:** `/api/holder/*` — certificate list and the privacy
  toggles. Visibility must not affect verifiability (FR-HOLD-07).
- **Rest of admin:** stats, org detail, suspend/reactivate, deactivate user,
  platform-wide certificates, audit log. Shapes are pinned by
  `useAdminMockData.ts`; note the DB role `holder` maps to the frontend's
  `recipient` at the response boundary.
- **Public registry:** `GET /api/registry`, to replace the hardcoded array in
  `LandingTrustBar.vue`.
- **API docs (`/api/docs`):** auto-generated Swagger page. `swagger-jsdoc` is
  installed and the routes already carry `@openapi` annotations.

**Deferred until the contract lands:** deploy `Verifier.sol`, fill
`CONTRACT_ADDRESS` and `PRIVATE_KEY`, restart, then `npm run chain:sync --yes` to
replay everything issued during stub mode. No application code changes — that is
what the two-implementation blockchain service bought.

---

## 8. How to run and test it yourself

```bash
cd backend
npm install              # once

npm test                 # run all 152 tests
npm run lint             # check code style
npm run dev              # start the server on http://localhost:3001

# useful checks:
curl localhost:3001/api/health
node --env-file=.env scripts/check-supabase.js   # is the DB set up?
node scripts/print-hash-vectors.js               # show the hash examples
```

Nothing here needs the blockchain or a fully configured `.env` — the tests use
placeholders and the stub, so `npm test` works on a fresh clone.

---

## 9. Glossary

| Term | Plain meaning |
| --- | --- |
| **JWT / access token** | A signed string proving "I logged in as this user". Sent on each request. Expires quickly. |
| **Refresh token** | A longer-lived token used to get a new access token without logging in again. |
| **RBAC** | Role-Based Access Control — deciding what someone can do based on their role. |
| **Hash / fingerprint** | A one-way code derived from data. Same input → same code; any change → totally different code. |
| **bytes32** | The blockchain's name for a 32-byte value — the size of our hash. |
| **Relayer wallet** | The single blockchain account the backend uses to write to the chain, holding a little POL for fees. |
| **Nonce** | A counter on each blockchain transaction; must increase in order, which is why we send them one at a time. |
| **RLS** | Row Level Security — database rules controlling which rows each key can see. Ours: deny all to public keys. |
| **Migration** | A SQL file that sets up (or changes) the database structure, run in order. |
| **PostgREST** | The service that turns Supabase tables into a web API (the thing that returned the `PGRST125` error). |
| **Stub** | A stand-in implementation with the same shape as the real thing, used for local dev/testing. |
| **Zod** | A library that validates incoming data against a schema before we trust it. |

---

## 10. Recent history (what changed in the last sessions)

- Replaced two broken starter files (TypeScript saved as `.js`, crashed on
  startup) with a real ESM Express app.
- Built config, logging (with PII redaction), error handling, rate limiting,
  and JWT/RBAC middleware.
- Wrote the database schema + security rules as SQL migrations.
- Built the hashing service with cross-language test vectors, and the blockchain
  service (real + stub) against the merged `Verifier.sol`.
- Built the authentication endpoints.
- Fixed a git branch divergence (merged latest `dev` in cleanly) and set up
  branch tracking.
- Diagnosed and defended against a broken `SUPABASE_URL` that was silently
  blocking all database access.
