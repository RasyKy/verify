-- ── 0007 — move certificate template choice from organization to course ────
--
-- Corrects 0006_certificate_branding.sql's scoping: the template a
-- certificate renders with is a per-course decision (e.g. a bootcamp track
-- vs. a formal degree programme may want different looks), not a single
-- institution-wide setting. Institution branding (logo, signature,
-- signatory) stays on `organizations` — only the template choice moves.
--
-- Purely presentational, same guarantee as 0006: not read by services/hash.js.

alter table courses
  add column if not exists certificate_template text
    not null default 'classic'
    check (certificate_template in ('classic', 'modern', 'editorial'));

alter table organizations drop column if exists certificate_template;
