-- ── 0006 — certificate template branding ───────────────────────────────────
--
-- Institution-level branding for server-rendered certificate documents
-- (PDF/PNG via services/certificateRender.js): a signature image and a
-- signatory name/title, plus which of the fixed templates the organization
-- has chosen. `logo_url` already exists on this table (0001_init.sql) and is
-- reused as-is.
--
-- Purely presentational, same guarantee 0004_course_badges.sql made for
-- badge_url: none of these columns are read by services/hash.js. The
-- canonical string stays [certId, studentName, courseName, completionDate,
-- expiryDate] only — see hash.js's own header comment.

alter table organizations
  add column if not exists signature_url text,
  add column if not exists signatory_name text,
  add column if not exists signatory_title text,
  add column if not exists certificate_template text
    not null default 'classic'
    check (certificate_template in ('classic', 'modern', 'editorial'));

-- Bucket ownership through the SQL Editor hits the same restriction
-- 0004_course_badges.sql documented — created via the Supabase Studio UI
-- (Storage → New bucket, public). This INSERT is kept for a fresh project
-- where the UI hasn't been used yet; `on conflict do nothing` makes it a
-- harmless no-op where the bucket already exists.
insert into storage.buckets (id, name, public)
values ('organization-assets', 'organization-assets', true)
on conflict (id) do nothing;
