# STRIDE mitigation checklist

The SRS makes this a **gate for mainnet deployment**: *"All 9 identified threats
have verified mitigations before mainnet deployment"* (Success Criteria). Each
threat needs a mitigation that is implemented **and** has a test or a recorded
manual check naming it.

Status: `☐` not started · `◐` implemented, unverified · `☑` implemented and
verified.

| ID | Threat | S | Mitigation | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| T-01 | Unauthorised wallet calls `issue()`/`revoke()` directly | E | OpenZeppelin `AccessControl`, `ISSUER_ROLE` — rejected on-chain | ☐ | Needs a Hardhat test that a non-role wallet reverts. **Owner: In Empiseysocheata.** Requested in [hash-spec.md](./hash-spec.md) |
| | *API-side counterpart* | E | `requireRole('issuer')` on every mutating route; `requireOrganization` | ◐ | [middleware/auth.js](../backend/src/middleware/auth.js). Needs the RBAC matrix test |
| T-02 | Claim token intercepted or replayed to hijack an account | S | Only `sha256(token)` stored; 7-day expiry; burned by a single atomic `UPDATE … WHERE used_at IS NULL RETURNING` | ☐ | Endpoint not yet built. Test must fire concurrent accepts and assert exactly one wins |
| T-03 | Issuer wallet private key stolen | E | Key in Railway env vars only; `.env` gitignored; validated at boot, never logged | ◐ | `git log --all -- backend/.env` → **empty, confirmed never committed**. `PRIVATE_KEY` is in the logger's redaction list. **Key-rotation procedure still unwritten — required before mainnet** |
| T-04 | Flood of the public verify endpoint | D | `express-rate-limit` tiered per endpoint; `trust proxy` set to a hop count; 30s chain-result cache; bounded cache size | ◐ | [middleware/rateLimit.js](../backend/src/middleware/rateLimit.js), [lib/cache.js](../backend/src/lib/cache.js). Cache coalescing verified in [tests/cache.test.js](../backend/tests/cache.test.js) (50 concurrent → 1 upstream call). Needs an autocannon run |
| T-05 | Certificate URLs enumerated to harvest student PII | I | IDs are v4 UUIDs; Zod rejects a non-UUID before any query; misses logged to `verification_logs` | ◐ | UUID rejection verified in [tests/schemas.test.js](../backend/tests/schemas.test.js) (`1`, `42`, `cert-001`, SQLi probe all rejected) |
| T-06 | Supabase breach exposes names and emails | I | RLS enabled with **no** `anon`/`authenticated` policies (deny-by-default) + grants revoked; PII off-chain only; logs redact name/email | ◐ | [0002_rls.sql](../backend/db/migrations/0002_rls.sql). Redaction verified in [tests/logger.test.js](../backend/tests/logger.test.js). Needs a live check: query `certificates` with the anon key → expect 0 rows |
| T-07 | Malformed or malicious input corrupts records | T | Zod on every route before business logic; `.strict()` rejects unknown fields; control characters rejected; DB `CHECK` constraints as a second line | ◐ | [schemas/](../backend/src/schemas/), verified in tests/schemas.test.js. Needs coverage on the remaining endpoints as they land |
| T-08 | Issuer denies issuing or disputes a revocation | R | Immutable on-chain records; `audit_events` on every mutation, `actor_id ON DELETE SET NULL` so deleting a user cannot erase the trail | ◐ | Table exists in [0001_init.sql](../backend/db/migrations/0001_init.sql). **Scope change to record in the SRS:** with one platform relayer wallet, on-chain non-repudiation is platform-level, not per-institution — institution attribution is in Supabase. See [hash-spec.md](./hash-spec.md) |
| T-09 | Fake institution registers and issues fraudulent certificates | S | No self-registration path exists at all; admin creates every issuer account; public accredited registry | ◐ | No registration endpoint by design ([user-flows.md](./user-flows.md) §1). `GET /api/registry` pending |

## Additional mitigations not in the SRS table

Found while building; worth recording since they close real gaps.

| Issue | Mitigation | Status |
| --- | --- | --- |
| **Privilege escalation via `user_metadata`** — it is user-writable via `auth.updateUser()`, and the frontend reads identity from it. A holder could have set `role: 'admin'` | Role comes from `app_metadata` (service-role writable only) **and** is re-checked against the `profiles` table on every request | ◐ |
| **RPC outage misreported as forgery** — collapsing an Alchemy failure into `invalid` would tell employers genuine certificates are fake | `UPSTREAM_UNAVAILABLE` (503) is distinct from `invalid` throughout | ◐ |
| **Stack traces / DB errors leaked to clients** | Only `AppError` messages cross the boundary; everything else becomes `INTERNAL_ERROR` | ◐ |
| **PII shipped to Sentry** — it captures request bodies independently of the logger, and an issuance payload contains a name and email | `beforeSend` strips `request.data`, cookies and the authorization header | ◐ |
| **Rate limiting defeated behind Railway's proxy** — with `trust proxy` unset every client shares one bucket; with `true`, a client can spoof `X-Forwarded-For` | `app.set('trust proxy', 1)` — the hop count | ◐ |
| **Vulnerable dependencies** (NFR-SEC-07) | `npm audit --audit-level=high` gates every PR | ☑ 0 vulnerabilities at time of writing |
| **Claim link ambiguity** — reissuing a claim email could leave two working links | Partial unique index: one unused token per certificate | ◐ |

## Before mainnet

1. Every row above at `☑`.
2. **Write the key-rotation procedure** (T-03 explicitly requires it; easiest thing here to skip).
3. Confirm the anon key cannot read any table — the one-command proof of T-06.
4. Confirm `git log --all -- backend/.env` is still empty.
5. Hardhat test proving `issue()`/`revoke()` revert without `ISSUER_ROLE` (T-01).
6. autocannon at 50 concurrent on `/verify/:certId` (NFR-PERF-03, T-04).
7. Record the two accepted scope changes in the SRS: platform-level on-chain
   non-repudiation (T-08), and gas paid in **POL** rather than MATIC since the
   2024 Polygon token migration.
