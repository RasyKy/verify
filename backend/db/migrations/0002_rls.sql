-- ============================================================================
-- Verify — 0002_rls
--
-- Row Level Security, deny-by-default (T-06, NFR-SEC-03).
--
-- Every application table has RLS enabled and NO policies granted to `anon` or
-- `authenticated`. With RLS on and no matching policy, Postgres denies the
-- row — so both the anon key and any user's own JWT can read exactly nothing
-- directly from the database.
--
-- All data access goes through the Express API using the service_role key,
-- which bypasses RLS by design. That is what makes this posture workable, and
-- it is safe here for a specific reason: the frontend's Supabase client is used
-- ONLY for authentication (see frontend/app/pages/login.vue) and never queries
-- a table. Nothing legitimate breaks.
--
-- What this buys: if the anon key leaks — and it ships to every browser, so
-- assume it will — an attacker gets no student names, no emails, no
-- certificate rows. Authorization lives in one place (middleware/auth.js +
-- requireRole) rather than being split between Express and a second, easily
-- mismatched set of SQL policies.
--
-- Trade-off, recorded deliberately: the API becomes the sole gatekeeper, so a
-- missing requireRole on a route is not caught by a second line of defence.
-- Mitigated by the RBAC matrix test in tests/ that asserts every route rejects
-- every role that should not reach it.
-- ============================================================================

alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table courses              enable row level security;
alter table certificates         enable row level security;
alter table certificate_hashes   enable row level security;
alter table claim_tokens         enable row level security;
alter table verification_logs    enable row level security;
alter table audit_events         enable row level security;
alter table expiry_notifications enable row level security;

-- Belt and braces. RLS already denies these roles for want of a policy;
-- revoking the grants means a policy added by accident later still cannot
-- expose a table without someone also re-granting SELECT.
revoke all on organizations        from anon, authenticated;
revoke all on profiles             from anon, authenticated;
revoke all on courses              from anon, authenticated;
revoke all on certificates         from anon, authenticated;
revoke all on certificate_hashes   from anon, authenticated;
revoke all on claim_tokens         from anon, authenticated;
revoke all on verification_logs    from anon, authenticated;
revoke all on audit_events         from anon, authenticated;
revoke all on expiry_notifications from anon, authenticated;

-- Sequences too: verification_logs.id is a bigserial, and a client able to
-- advance the sequence could disrupt inserts.
revoke all on sequence verification_logs_id_seq from anon, authenticated;

-- ── Deliberately NOT added ──────────────────────────────────────────────────
--
-- No "holders can read their own certificates" policy. It looks harmless and
-- would let the frontend query Supabase directly, but it would mean two
-- independent authorization models to keep in agreement — and the privacy rules
-- (FR-HOLD-05/06/07, where a hidden certificate is invisible on a profile yet
-- still verifiable by direct URL) do not express cleanly as row filters. One
-- model, in the API, is the safer choice for this project.
--
-- Should the frontend ever need direct table reads, add narrow policies here
-- rather than loosening the API.
