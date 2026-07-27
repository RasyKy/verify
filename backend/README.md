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
scripts/                  print-hash-vectors.js
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
# Apply in order via the Supabase SQL editor or `supabase db push`
db/migrations/0001_init.sql   # enums, tables, indexes, triggers
db/migrations/0002_rls.sql    # RLS: deny-by-default
```

ER diagram and the reasoning behind the shape:
[docs/er-diagram.md](../docs/er-diagram.md).

RLS is enabled with **no policies** for `anon` or `authenticated`, so neither can
read anything directly. All access goes through this API with the service-role
key. Safe because the frontend's Supabase client is used only for authentication
and never queries a table — and it means a leaked anon key (it ships to every
browser) exposes nothing.

## Six things that will surprise you

**1. This API never mints tokens.** The Nuxt app signs in directly against
Supabase Auth; `middleware/auth.js` only verifies the resulting JWT. There is no
`/auth/login`. Re-implementing token refresh in Express would be a weaker copy of
what supabase-js already does.

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
