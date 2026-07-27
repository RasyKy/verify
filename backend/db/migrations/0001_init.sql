-- ============================================================================
-- Verify — 0001_init
--
-- Enums, tables, indexes and triggers. RLS is applied separately in 0002.
--
-- Apply with the Supabase SQL editor or `supabase db push`. Migrations are
-- plain SQL and numbered so the schema can be replayed onto a fresh project —
-- which is how the Amoy → mainnet cutover is rehearsed.
--
-- Design notes worth reading before changing anything:
--   • No `status` column on certificates. Status is DERIVED on read from
--     claim_state / revoked_at / expiry_date (src/lib/derivedStatus.js).
--     A stored status would go stale the day a certificate expires.
--   • `certificates.course_name` is a TEXT SNAPSHOT, not just a FK. The
--     on-chain hash covers that exact string, so renaming a course must never
--     invalidate certificates already issued.
--   • Hashes live in their own table, not on `certificates`. FR-MGMT-04 "edit"
--     is really revoke-then-reissue, which produces a new hash while the
--     certificate UUID (and therefore every QR code already in the wild) must
--     stay the same.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email

-- ── Enums ───────────────────────────────────────────────────────────────────

create type user_role as enum ('admin', 'issuer', 'holder');

create type account_status as enum ('active', 'deactivated');

-- Mirrors the Org.type union in frontend/app/composables/useAdminMockData.ts.
create type org_type as enum ('university', 'bootcamp', 'professional-body', 'event');

create type org_status as enum ('active', 'suspended');

-- Ownership only. NOT the displayed status — see derivedStatus.js.
create type claim_state as enum ('unclaimed', 'claimed');

create type chain_status as enum ('pending', 'confirmed', 'failed');

-- Result of a public verification attempt, for verification_logs.
create type verify_result as enum ('verified', 'invalid', 'revoked', 'expired', 'not_found', 'error');

-- Mirrors the AuditAction union in useAdminMockData.ts exactly, so the admin
-- audit page can render rows without a translation layer.
create type audit_action as enum (
  'certificate.issued',
  'certificate.revoked',
  'certificate.reissued',
  'certificate.claimed',
  'issuer.invited',
  'issuer.removed',
  'org.created',
  'org.suspended',
  'org.reactivated'
);

-- ── Shared trigger ──────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── organizations ───────────────────────────────────────────────────────────

create table organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  type              org_type not null,
  website           text,
  logo_url          text,
  -- The relayer wallet is platform-wide (one ISSUER_ROLE key, see
  -- services/blockchain.js). This column records the institution's own address
  -- for future per-institution attribution; it is not used to sign today.
  wallet_address    text,
  status            org_status not null default 'active',
  -- Drives the public registry on the landing page (FR-REG-01). Separate from
  -- `status`: an org can be active but not yet listed publicly.
  accredited        boolean not null default false,
  joined_at         date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint organizations_name_not_blank check (length(btrim(name)) > 0)
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create index organizations_status_idx on organizations (status);
create index organizations_accredited_idx on organizations (accredited) where accredited;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Application mirror of auth.users. The SOURCE OF TRUTH for role and
-- organization: middleware/auth.js reads this rather than trusting the JWT's
-- app_metadata claim, because app_metadata only reaches a token on its next
-- refresh and a deactivation must take effect sooner than that.

create table profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             citext not null unique,
  full_name         text,
  role              user_role not null,
  -- Null for holders, who belong to no institution. Enforced below.
  organization_id   uuid references organizations (id) on delete restrict,
  status            account_status not null default 'active',
  -- FR-HOLD-04: profiles are public by default.
  profile_is_public boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- An issuer with no organization could create unscoped certificates visible
  -- to nobody; an admin belongs to the platform, not an institution.
  constraint profiles_org_required_for_issuer check (
    (role = 'issuer' and organization_id is not null)
    or (role <> 'issuer')
  )
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create index profiles_organization_idx on profiles (organization_id);
create index profiles_role_idx on profiles (role);
create index profiles_email_idx on profiles (email);

-- ── courses ─────────────────────────────────────────────────────────────────
-- Backs the typeahead in CertificateForm.vue. Scoped per organization so one
-- institution's course list never leaks into another's.

create table courses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  created_by      uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  -- Makes POST /api/courses idempotent: the typeahead can fire twice on a
  -- fast double-click, and the second insert must collide rather than duplicate.
  constraint courses_unique_per_org unique (organization_id, name),
  constraint courses_name_not_blank check (length(btrim(name)) > 0)
);

create index courses_organization_idx on courses (organization_id);

-- ── certificates ────────────────────────────────────────────────────────────

create table certificates (
  -- This UUID *is* the public certificate ID in /verify/[certId] and the QR
  -- payload. Random, not sequential, so the URL space cannot be enumerated
  -- to harvest student PII (NFR-SEC-04, T-05).
  id                uuid primary key default gen_random_uuid(),

  organization_id   uuid not null references organizations (id) on delete restrict,
  issuer_id         uuid references profiles (id) on delete set null,
  holder_id         uuid references profiles (id) on delete set null,

  -- PII. Off-chain only, never hashed into a public ledger in plaintext
  -- (NFR-SEC-02, T-06). Protected by RLS in 0002.
  student_name      text not null,
  student_email     citext not null,

  -- Snapshot, deliberately denormalised — see the header note.
  course_name       text not null,
  course_id         uuid references courses (id) on delete set null,

  completion_date   date not null,
  expiry_date       date,

  claim_state       claim_state not null default 'unclaimed',
  claimed_at        timestamptz,

  revoked_at        timestamptz,
  revoked_by        uuid references profiles (id) on delete set null,
  revoke_reason     text,

  -- FR-HOLD-06: hides the certificate from the holder's public profile.
  -- Does NOT affect verifiability by direct URL (FR-HOLD-07).
  is_hidden         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint certificates_student_name_not_blank check (length(btrim(student_name)) > 0),
  constraint certificates_course_name_not_blank check (length(btrim(course_name)) > 0),
  -- Expiring before completion is nonsense and would render as permanently
  -- expired; reject it at the storage layer as well as in Zod.
  constraint certificates_expiry_after_completion check (
    expiry_date is null or expiry_date > completion_date
  ),
  constraint certificates_claimed_has_holder check (
    (claim_state = 'claimed' and holder_id is not null and claimed_at is not null)
    or (claim_state = 'unclaimed')
  )
);

create trigger certificates_set_updated_at
  before update on certificates
  for each row execute function set_updated_at();

-- Issuer list, newest first (GET /api/certificates).
create index certificates_org_created_idx on certificates (organization_id, created_at desc);
-- Holder dashboard (GET /api/holder/certificates).
create index certificates_holder_idx on certificates (holder_id) where holder_id is not null;
-- Links a claim to any other certificate already issued to the same address.
create index certificates_student_email_idx on certificates (student_email);
-- The 60-day expiry sweep scans only rows that can actually expire.
create index certificates_expiry_idx on certificates (expiry_date) where expiry_date is not null;
create index certificates_dashboard_idx on certificates (organization_id, completion_date);

-- ── certificate_hashes ──────────────────────────────────────────────────────
-- One row per on-chain record. A certificate has exactly one current hash and
-- any number of superseded ones from edits (FR-MGMT-04).

create table certificate_hashes (
  id                uuid primary key default gen_random_uuid(),
  certificate_id    uuid not null references certificates (id) on delete cascade,

  -- 0x + 64 hex = the bytes32 stored on chain. Globally unique: the certificate
  -- UUID is part of the preimage, so a collision would mean a hash reuse bug.
  hash              text not null unique,
  -- Which canonical-string recipe produced it (services/hash.js). Lets the
  -- format change later without stranding certificates already issued.
  hash_version      integer not null default 1,

  -- Unix seconds; 0 means never. Must equal the expiry inside the hash.
  expires_at_unix   bigint not null default 0,

  issue_tx_hash     text,
  revoke_tx_hash    text,
  -- Block timestamp of issuance — the "Recorded on the Polygon blockchain"
  -- line in ResultCard.vue.
  chain_issued_at   timestamptz,
  chain_status      chain_status not null default 'pending',
  chain_error       text,

  -- Set when superseded by an edit.
  revoked_at        timestamptz,
  is_current        boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint certificate_hashes_format check (hash ~ '^0x[0-9a-f]{64}$')
);

create trigger certificate_hashes_set_updated_at
  before update on certificate_hashes
  for each row execute function set_updated_at();

create unique index certificate_hashes_one_current_idx
  on certificate_hashes (certificate_id) where is_current;

create index certificate_hashes_hash_idx on certificate_hashes (hash);
-- Drives jobs/reconcilePendingTx.js.
create index certificate_hashes_pending_idx
  on certificate_hashes (chain_status) where chain_status = 'pending';

-- ── claim_tokens ────────────────────────────────────────────────────────────
-- FR-CLAIM-01..04, T-02.

create table claim_tokens (
  id              uuid primary key default gen_random_uuid(),
  certificate_id  uuid not null references certificates (id) on delete cascade,

  -- SHA-256 of the token, never the token itself. A database leak must not
  -- hand the attacker working claim links (T-02, T-06).
  token_hash      text not null unique,

  expires_at      timestamptz not null,
  used_at         timestamptz null,
  sent_to         citext not null,
  created_at      timestamptz not null default now(),

  constraint claim_tokens_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

create index claim_tokens_certificate_idx on claim_tokens (certificate_id);
-- Only one live token per certificate: reissuing a claim email must invalidate
-- the previous link rather than leave two valid ways in.
create unique index claim_tokens_one_active_idx
  on claim_tokens (certificate_id) where used_at is null;

-- ── verification_logs ───────────────────────────────────────────────────────
-- Feeds the admin `verificationsLast30` stat and gives T-04 something to
-- detect a flood against.

create table verification_logs (
  id              bigserial primary key,
  certificate_id  uuid references certificates (id) on delete set null,
  -- The raw string requested, kept even when it matches nothing — that is
  -- exactly the signal an enumeration attempt produces.
  queried_id      text not null,
  result          verify_result not null,
  -- Hashed, not stored: an IP address is personal data, and the analytics only
  -- need "same client or not" (T-06).
  ip_hash         text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index verification_logs_created_idx on verification_logs (created_at desc);
create index verification_logs_certificate_idx on verification_logs (certificate_id);

-- ── audit_events ────────────────────────────────────────────────────────────
-- T-08 (repudiation). On-chain records prove what happened to a hash; this
-- proves who asked for it and when.

create table audit_events (
  id              uuid primary key default gen_random_uuid(),
  -- Nullable and ON DELETE SET NULL: deleting a user must never erase the
  -- audit trail of what they did.
  actor_id        uuid references profiles (id) on delete set null,
  -- Denormalised so the row stays readable after the account is gone.
  actor_email     citext,
  actor_name      text,
  action          audit_action not null,
  target_label    text not null,
  organization_id uuid references organizations (id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index audit_events_created_idx on audit_events (created_at desc);
create index audit_events_organization_idx on audit_events (organization_id, created_at desc);
create index audit_events_action_idx on audit_events (action);

-- ── expiry_notifications ────────────────────────────────────────────────────
-- FR-EXP-03. The unique constraint IS the idempotency guard: a job restart or
-- a double fire cannot email the same holder twice.

create table expiry_notifications (
  id              uuid primary key default gen_random_uuid(),
  certificate_id  uuid not null references certificates (id) on delete cascade,
  kind            text not null default '60_day',
  sent_at         timestamptz not null default now(),

  constraint expiry_notifications_once unique (certificate_id, kind)
);
