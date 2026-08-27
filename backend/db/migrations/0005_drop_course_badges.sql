-- ── 0005 — remove per-course credential badges ─────────────────────────────
--
-- Reverses 0004_course_badges.sql. The badge feature is replaced entirely by
-- server-rendered certificate templates (0006_certificate_branding.sql) —
-- institution branding lives on `organizations`, not per-course.
--
-- The `course-badges` storage bucket is NOT dropped here — bucket ownership
-- through the SQL Editor hits the same restriction 0004's own comment
-- documented for creating it. Its objects were emptied and the bucket deleted
-- manually via the Supabase Studio Storage UI, alongside this migration.

alter table courses drop column if exists badge_url;
