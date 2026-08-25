-- ── 0004 — per-course credential badges ────────────────────────────────────
--
-- Adds a display-only badge image per course (Credly-style), shown on every
-- certificate for that course. Purely presentational: badge_url is never
-- read by services/hash.js, so it has zero effect on the certificate hash,
-- the chain, or verification (see hash.js's canonical string, which is
-- [certId, studentName, courseName, completionDate, expiryDate] only).
--
-- Read vs. write are two separate mechanisms here, deliberately not conflated:
--   READ  — the bucket's own `public` flag below. Makes every object fetchable
--           by its public URL, which is what badge display needs. Nothing to
--           do with RLS.
--   WRITE — storage.objects RLS, same deny-by-default posture as every
--           application table (0002_rls.sql), but supplied by the Supabase
--           platform itself: RLS ships enabled on storage.objects by default,
--           on every project, before this migration ever runs. No policy is
--           added for anon or authenticated here (and none should be), so
--           neither can INSERT/UPDATE/DELETE a single object regardless of
--           login status — verified directly against this project (an
--           anonymous upload attempt with the anon key returns 403, "new row
--           violates row-level security policy"). The only writer is the
--           backend's service-role client, from POST/DELETE
--           /api/courses/:id/badge (routes/courses.js), which is already
--           gated by requireRole(ISSUER) plus an organization-ownership
--           check before it ever calls storage.js. There is deliberately no
--           `alter table storage.objects enable row level security` here: it
--           would be a no-op at best, and storage.objects is owned by a
--           Supabase-internal role, so a project owner typically cannot run
--           it at all.
--
-- The bucket itself was created via the Supabase Studio UI (Storage → New
-- bucket, public) rather than by the INSERT below, because storage.buckets
-- hit the same ownership restriction through the SQL Editor. The INSERT is
-- kept for a fresh project where the UI hasn't been used yet; `on conflict
-- do nothing` makes it a harmless no-op here, where the bucket already
-- exists.

alter table courses add column if not exists badge_url text;

insert into storage.buckets (id, name, public)
values ('course-badges', 'course-badges', true)
on conflict (id) do nothing;
