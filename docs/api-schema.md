# Verify — API schema

Base path `/api`. Served by [backend/](../backend/). Live OpenAPI at `/api/docs`
once Swagger lands (NFR-MAINT-02); this document is the human-readable contract
and the source the frontend was written against.

Legend — **Auth**: `public` (no token) · `any` · `issuer` · `holder` · `admin`.

## Conventions

**Authentication.** `Authorization: Bearer <supabase-access-token>`. The
frontend obtains it by signing in directly against Supabase Auth; this API only
verifies it. There is no `POST /auth/login` — see
[frontend-handshake.md](./frontend-handshake.md).

**Casing is asymmetric, deliberately.** Responses on the issuer list are
**snake_case**; request bodies and the verify response are **camelCase**. This
matches what the existing frontend components already destructure. It is not an
oversight — normalising it means edits across the issuer table and modals, which
is a call for whoever owns those files.

**Errors.**

```json
{
  "error": { "code": "VALIDATION_FAILED", "message": "Request validation failed.", "requestId": "…" },
  "message": "Request validation failed.",
  "fieldErrors": { "studentEmail": ["must be a valid email address"] }
}
```

`message` is duplicated at the top level because the frontend reads
`err.data.message`. Stack traces and database errors are never included
(NFR-SEC-06). Codes: `BAD_REQUEST` `VALIDATION_FAILED` `UNAUTHENTICATED`
`FORBIDDEN` `NOT_FOUND` `CONFLICT` `RATE_LIMITED` `UPSTREAM_UNAVAILABLE`
`INTERNAL_ERROR`.

**`UPSTREAM_UNAVAILABLE` (503) is load-bearing.** When Alchemy or Supabase is
unreachable, verification returns 503 — never `invalid`. Reporting a genuine
certificate as fake because a node provider blipped is the worst failure this
system can produce.

**Rate limits** (NFR-SEC-05, T-04): verify 30/min/IP · claim-accept 5/15min/IP ·
issuance 200/hr/**organization** · everything else 120/min/IP. Responses carry
draft-8 `RateLimit-*` headers.

**Status vocabularies.** Two, both derived server-side, never stored:

| Surface | Values |
| --- | --- |
| Issuer table | `valid` · `revoked` · `expired` · `unclaimed` |
| Public verify | `verified` · `invalid` · `revoked` · `expired` |

There is no `claimed` status — the frontend has no chip for it, so a claimed,
still-valid certificate is reported as `valid`. Precedence: issuer list is
revoked → expired → claimed → unclaimed; verify is invalid → revoked → expired →
verified.

---

## Ops

### `GET /api/health` · public
```json
{ "status": "ok", "env": "production", "chainId": 137, "uptimeSeconds": 8421 }
```

### `GET /api/docs` · public
Swagger UI.

---

## Auth

### `GET /api/auth/me` · any
Role and organization bootstrap. Role comes from the `profiles` table, not the
JWT claim, so a deactivation takes effect within 60s rather than on next token
refresh.

```json
{
  "id": "uuid",
  "email": "sothea@rppu.edu.kh",
  "role": "issuer",
  "organization": { "id": "uuid", "name": "Royal Phnom Penh University", "slug": "rppu", "type": "university", "status": "active" }
}
```
`organization` is `null` for admins and holders. → `401` `403` (deactivated)

---

## Claiming · FR-CLAIM-01..04

### `GET /api/claims/:token` · public
Validates a claim token and previews the certificate. Rejects a used or expired
token (7-day lifetime, FR-AUTH-03).

```json
{
  "certificate": { "certId": "uuid", "studentName": "Chea Sophat", "courseName": "…", "institutionName": "…", "completionDate": "2026-02-03", "expiryDate": null },
  "email": "sophat.chea@gmail.com",
  "expiresAt": "2026-08-01T09:15:00Z"
}
```
→ `404` unknown · `410` used or expired

### `POST /api/claims/:token/accept` · public
Body `{ "password": "…" }` (min 8). Burns the token atomically, creates or links
the holder account, links the certificate. → `200` · `409` already claimed ·
`410` expired · `429`

---

## Certificates — issuer

### `GET /api/certificates` · issuer
Scoped to the caller's organization. **snake_case**, matching
`pages/issuer/certificates.vue`.

```json
[
  {
    "id": "uuid",
    "student_name": "Chea Sophat",
    "student_email": "sophat.chea@gmail.com",
    "course_name": "Web Development Fundamentals",
    "completion_date": "2026-02-03",
    "expiry_date": null,
    "status": "valid",
    "institution_id": "uuid",
    "issued_at": "2026-02-03T09:15:00Z",
    "revoked_at": null
  }
]
```
Query (optional — the table filters client-side today): `status` `search`
`limit` (≤500, default 200) `offset`.

### `POST /api/certificates` · issuer · FR-ISSUE-01..07
**camelCase** body, as `CertificateForm.vue` sends:

```json
{
  "studentName": "Chea Sophat",
  "studentEmail": "sophat.chea@gmail.com",
  "courseName": "Web Development Fundamentals",
  "completionDate": "2026-02-03",
  "expiryDate": null,
  "institution": "Royal Phnom Penh University"
}
```

`institution` is **accepted and discarded.** The form pre-fills it from
`user_metadata.institution_name`, which the user can edit — honouring it would
let an issuer attribute a certificate to any institution they typed. The
organization is taken from the authenticated issuer's profile.

Server-side rules the browser cannot be trusted with: `completionDate` not in
the future; `expiryDate` strictly after `completionDate`; unknown fields
rejected; control characters rejected (not stripped — silently altering input
would change what the issuer believed they were signing).

`201`:
```json
{ "id": "uuid", "status": "unclaimed", "hash": "0x…", "issue_tx_hash": "0x…", "chain_status": "confirmed", "claim_email_sent": true }
```
`chain_status` may be `pending` if confirmation exceeded 25s; a reconciler
completes it. `claim_email_sent: false` means the certificate is valid but
Resend failed — a queued retry, not a failed issuance. → `403` no organization ·
`422` · `503` chain unreachable

### `GET /api/certificates/:id` · issuer
Single certificate, snake_case, org-scoped. → `404`

### `PUT /api/certificates/:id` · issuer · FR-MGMT-04
Same body as `POST` minus `institution`. Presented as an edit; implemented as
revoke-the-old-hash + issue-the-new-one. **The certificate UUID does not
change**, so QR codes and links already in circulation keep working.

`200`: `{ "id": "uuid", "hash": "0x…(new)", "previous_hash": "0x…", "revoke_tx_hash": "0x…", "issue_tx_hash": "0x…" }`
→ `409` already revoked · `503`

### `POST /api/certificates/:id/revoke` · issuer · FR-MGMT-03
Body optional `{ "reason": "…" }` — `RevokeConfirmModal.vue` sends none.
`200`: `{ "id": "uuid", "status": "revoked", "revoked_at": "…", "revoke_tx_hash": "0x…" }`
→ `409` already revoked · `503`

### `POST /api/certificates/:id/resend-claim` · issuer + admin
No body. Retires the outstanding claim token and mints a replacement, valid
another 7 days, then emails it. The only route open to both roles: an issuer is
scoped to their own institution, an admin is not scoped at all.

Exists because the raw token lives *only* inside the email that carries it —
`claim_tokens` stores the sha256 — so a delivery failure otherwise leaves a
valid certificate nobody can ever claim.

`200`: `{ "id", "sent_to", "claim_email_sent", "expires_at", "claim_url"? }`
→ `404` no such certificate · `409` already claimed, or revoked

`claim_url` is the live link and is **present outside production only**, so the
flow stays testable when mail cannot be delivered. It is not a way in: the
claim still requires a session whose email matches `sent_to`.

### `GET /api/certificates/:id/qr` · public · FR-HOLD-02
PNG of `${FRONTEND_URL}/verify/${id}` — the exact form
`QrScannerModal.vue` parses. `?format=svg&size=512` supported. Public because a
QR code is meant to be embedded in a shared certificate page.

---

## Verification · public · FR-VERIFY-01..05

### `GET /api/certificates/verify/:certId`
No auth, works on mobile, rate limited. **camelCase**, matching
`ResultCard.vue`.

```json
{
  "status": "verified",
  "certificate": {
    "studentName": "Chea Sophat",
    "courseName": "Web Development Fundamentals",
    "institutionName": "Royal Phnom Penh University",
    "completionDate": "2026-02-03",
    "expiryDate": null,
    "certId": "uuid",
    "issuedAtBlockchainTimestamp": "2026-02-03T09:15:22Z"
  }
}
```

- `invalid` → `certificate: null` (the frontend renders "Certificate not found").
  Both "no such ID" and "hash mismatch" return this: a verifier learns the
  credential cannot be trusted without learning which failure occurred.
- `revoked` / `expired` → details still included, as `ResultCard.vue` displays
  them for those states.
- Ignores `is_hidden` and `profile_is_public` entirely (FR-HOLD-07).
- A malformed ID returns `invalid`, not a 500 — the search box accepts free text.

→ `429` · `503` chain unreachable

---

## Courses · issuer

### `GET /api/courses`
`["Web Development Fundamentals", "Python Programming"]` — a bare string array,
which is what the `UInputMenu` typeahead consumes. Org-scoped.

### `POST /api/courses`
`{ "name": "Machine Learning Fundamentals" }` → `201 { "id": "uuid", "name": "…" }`.
Idempotent on `(organization, name)`: the typeahead can fire twice on a fast
double-click, so a repeat returns the existing row rather than erroring.

---

## Dashboard · issuer · FR-MGMT-05

### `GET /api/dashboard?range=7d|30d|90d`
```json
{
  "stats": { "total": 42, "valid": 30, "revoked": 4, "expired": 8 },
  "chartData": [{ "date": "2026-06-25", "count": 3 }],
  "recentActivity": [{ "type": "issued", "studentName": "Chea Sophat", "courseName": "…", "timestamp": "2026-07-24T09:15:00Z" }]
}
```
`chartData` is zero-filled for every day in the range — gaps would make the line
chart misrepresent the data. `recentActivity.type` is `issued` | `revoked` |
`claimed`, the three `IssuerRecentActivity.vue` has icons for.

---

## Holder · FR-HOLD-01..07

### `GET /api/holder/certificates` · holder
Own certificates, snake_case, plus `is_hidden`.

### `GET /api/holder/profile` · holder
`{ "profile_is_public": true }` — the caller's current setting.

### `PATCH /api/holder/profile` · holder
`{ "profile_is_public": false }` → takes the public profile page offline
entirely (FR-HOLD-05). Public by default (FR-HOLD-04).

### `PATCH /api/holder/certificates/:id` · holder
`{ "is_hidden": true }` → hides one certificate from the public profile without
affecting the others (FR-HOLD-06). **Does not affect verifiability**
(FR-HOLD-07).

### `GET /api/profiles/:holderId` · public · FR-HOLD-04/05/06
The browsable profile the two flags above govern — **the only endpoint in the
API that reads them**. Rendered by `pages/p/[holderId].vue`.

```json
{
  "holder": { "id": "uuid", "display_name": "Chea Sophat" },
  "certificates": [
    {
      "id": "uuid",
      "course_name": "BSc Computer Science",
      "institution_name": "Royal Phnom Penh University",
      "completion_date": "2026-02-03",
      "expiry_date": null,
      "issued_at": "2026-02-03T09:15:00Z",
      "issuedAtBlockchainTimestamp": "2026-02-03T09:15:22Z",
      "status": "valid"
    }
  ]
}
```

- Lists only `is_hidden = false`, filtered in the query — a hidden row never
  leaves the database.
- Returns neither `is_hidden` (every row here is visible by definition) nor
  `student_name` / `student_email`. The holder's name lives on the profile, and
  falls back to a certificate's `student_name` rather than the email local part
  when `full_name` is unset — the label is published to anyone with the link.
- Revoked and expired certificates are listed **with their status**, not
  dropped. Silently omitting them would leave a browsing employer unable to
  tell absence from revocation; the holder's own per-certificate hide toggle is
  the tool for that.
- Empty `certificates` with a `200` is a real state: profile public, every
  certificate hidden.

→ `404` for a nonexistent profile, a non-holder, a deactivated account, **and a
private one** — deliberately indistinguishable. A distinct "this profile is
private" response would confirm the account exists and has chosen to hide,
which is the fact the setting exists to withhold, and would turn the endpoint
into an existence oracle (T-05).

→ `422` on a non-UUID `holderId` · `429` (30/min, `publicProfileLimiter`)

---

## Public registry · FR-REG-01..03

### `GET /api/registry` · public
Accredited institutions for the landing page — replaces the hardcoded array in
`LandingTrustBar.vue`.
```json
[{ "id": "uuid", "name": "Royal Phnom Penh University", "type": "university", "website": "rppu.edu.kh", "joined_at": "2024-09-01" }]
```

---

## Admin

Shapes mirror the `Org` / `AdminUser` / `AdminCert` / `AuditEvent` interfaces at
the top of
[useAdminMockData.ts](../frontend/app/composables/useAdminMockData.ts), so the
admin portal swaps that composable for `useApi()` and needs no other change.

| Endpoint | Notes |
| --- | --- |
| `GET /api/admin/stats` | `{ totalOrgs, totalCerts, activeIssuers, verificationsLast30, monthlyCerts }` — `verificationsLast30` from `verification_logs`, `monthlyCerts` a 6-month rollup |
| `GET` `POST /api/admin/organizations` | `POST` creates an org · FR-INST-02 |
| `GET /api/admin/organizations/:id` | Org + its issuers + its certificates |
| `PATCH /api/admin/organizations/:id` | Partial: `name` `type` `status` `website` `logoUrl` `accredited`. Suspend/reactivate is `status`, not its own endpoint |
| `DELETE /api/admin/organizations/:id` | Refused while any issuer or certificate still belongs to it |
| `GET` `POST /api/admin/users` | `POST` creates an issuer — the ONLY way an issuer account comes into being (FR-AUTH-01). Note it sends no mail |
| `PATCH /api/admin/users/:id` | Partial: `fullName` `status` `organizationId`. Deactivation takes effect within 60s (profile cache TTL) |
| `DELETE /api/admin/users/:id` | Deletes the auth user; the profile cascades. Certificates the account had claimed are returned to `unclaimed` first — `certificates_claimed_has_holder` would otherwise abort the cascade |
| `GET /api/admin/certificates` | Platform-wide. `status` is `issued` \| `revoked` per the admin union; `claimState` is reported separately, alongside `completionDate` and `expiryDate` |
| `POST /api/admin/certificates` | Issue on any institution's behalf — `organizationId` is required, an admin has no default |
| `PUT /api/admin/certificates/:id` | Correction: revokes the old hash and anchors a new one, keeping the certificate ID (FR-MGMT-04) |
| `POST /api/admin/certificates/:id/revoke` | Platform override of an institution's certificate |
| `DELETE /api/admin/certificates/:id` | Erases the row. The chain entry cannot be erased, so the ID then reports `invalid`, not `revoked` |
| `GET /api/admin/audit` | `?action=&organizationId=&limit=&offset=` · T-08 |

Every admin mutation writes an `audit_events` row. That is the whole of T-08
(repudiation): the chain proves what happened to a hash, the audit log proves who
asked for it.

---

## Requirements coverage

| Requirement | Endpoint |
| --- | --- |
| FR-AUTH-01/02/04/05 | Supabase Auth + `requireAuth` / `requireRole`; `GET /api/auth/me` |
| FR-AUTH-03, FR-CLAIM-01..04 | `/api/claims/*` |
| FR-INST-01..03 | `/api/admin/organizations`, `/api/admin/users` |
| FR-ISSUE-01..07 | `POST /api/certificates` |
| FR-MGMT-01..05 | `GET /api/certificates`, `PUT`, `/revoke`, `/api/dashboard` |
| FR-HOLD-01..07 | `/api/holder/*`, `GET /api/profiles/:holderId`, `GET /api/certificates/:id/qr` |
| FR-VERIFY-01..05 | `GET /api/certificates/verify/:certId` |
| FR-REG-01..03 | `GET /api/registry` |
| FR-EXP-01..04 | `expiryDate` on issue/update; `jobs/expiryNotifications.js` |
| NFR-SEC-03..07 | `requireRole`, UUID IDs, rate limits, Zod, `npm audit` in CI |
| NFR-MAINT-02 | `GET /api/docs` |
