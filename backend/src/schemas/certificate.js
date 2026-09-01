/**
 * Certificate request schemas.
 *
 * Mirrors the client-side schema in
 * frontend/app/components/issuer/CertificateForm.vue so the two agree on the
 * happy path, and adds the rules a browser cannot be trusted to enforce.
 *
 * Both projects are pinned to zod 4.4.3 — keep them in lockstep so a message
 * the user sees in the form matches what the API would have said.
 */
import { z } from 'zod';

import { email, hashableText, isoDate, pastOrToday } from './common.js';
import { ISSUER_STATUS_VALUES } from '../lib/derivedStatus.js';

/**
 * POST /api/certificates — issuance (FR-ISSUE-01).
 *
 * Field names are camelCase because that is what CertificateForm.vue sends.
 * (Responses are snake_case; see docs/api-schema.md for why that asymmetry is
 * preserved rather than "fixed".)
 */
export const issueCertificateSchema = z
  .object({
    studentName: hashableText('Recipient name', { min: 2, max: 120 }),
    studentEmail: email,
    courseName: hashableText('Course name', { min: 1, max: 200 }),
    completionDate: pastOrToday('Completion date'),
    expiryDate: isoDate.nullish(),

    /**
     * The form sends this, and the backend IGNORES it.
     *
     * CertificateForm.vue pre-fills it from `user_metadata.institution_name`,
     * which the user can edit — accepting it would let an issuer attribute a
     * certificate to any institution they cared to type. The organization is
     * derived from the authenticated issuer's profile instead. Accepted-and-
     * discarded rather than rejected so the existing form keeps working.
     */
    institution: z.string().optional(),
  })
  .strict()
  .refine((data) => !data.expiryDate || data.expiryDate > data.completionDate, {
    message: 'Expiry date must be after the completion date',
    path: ['expiryDate'],
  })
  .transform(({ institution: _ignored, ...rest }) => ({
    ...rest,
    expiryDate: rest.expiryDate ?? null,
  }));

/**
 * PUT /api/certificates/:id — edit (FR-MGMT-04).
 *
 * The UI presents this as an edit; the backend revokes the current hash on
 * chain and issues a new one, keeping the same certificate UUID so QR codes
 * already in circulation still resolve.
 */
export const updateCertificateSchema = z
  .object({
    studentName: hashableText('Recipient name', { min: 2, max: 120 }),
    studentEmail: email,
    courseName: hashableText('Course name', { min: 1, max: 200 }),
    completionDate: pastOrToday('Completion date'),
    expiryDate: isoDate.nullish(),
  })
  .strict()
  .refine((data) => !data.expiryDate || data.expiryDate > data.completionDate, {
    message: 'Expiry date must be after the completion date',
    path: ['expiryDate'],
  })
  .transform((data) => ({ ...data, expiryDate: data.expiryDate ?? null }));

/** POST /api/certificates/:id/revoke — the modal sends no body. */
export const revokeCertificateSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * GET /api/certificates — issuer list filters.
 *
 * The frontend filters and searches client-side today, so these are optional.
 * They exist because that list grows unboundedly and the table will need
 * server-side filtering before an institution has issued a few thousand.
 */
export const listCertificatesSchema = z.object({
  status: z.enum(ISSUER_STATUS_VALUES).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/certificates/verify/:certId — public.
 *
 * `certId` is validated as a UUID, which is itself a cheap enumeration defence:
 * a scanner walking sequential IDs is rejected before touching the database
 * (T-05). Note the frontend lets a verifier paste anything into the search box,
 * so a malformed ID must produce a clean "not found", never a 500.
 */
export const verifyParamsSchema = z.object({
  certId: z.uuid('That does not look like a valid certificate ID'),
});

/**
 * `:id` on the issuer-facing routes.
 *
 * Unlike the verify path, a malformed ID here IS a client error: these routes
 * are reached from the app's own table, never from a paste box, so 422 is the
 * honest answer rather than a silent "not found".
 */
export const certIdParamSchema = z.object({
  id: z.uuid('That does not look like a valid certificate ID'),
});

/**
 * GET /api/certificates/:id/qr — PNG by default so the frontend can point an
 * <img> straight at it; SVG for print.
 */
export const qrQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  // Upper bound is a denial-of-service guard: rendering is CPU-bound and this
  // endpoint is public and unauthenticated (T-04).
  size: z.coerce.number().int().min(64).max(1024).default(320),
});

/**
 * GET /api/certificates/:id/download — rendered PDF or PNG document.
 * `size: 'thumb'` only affects the PNG branch (a lower-resolution render for
 * dashboard card previews) — harmless, ignored for `format: 'pdf'`.
 */
export const downloadQuerySchema = z.object({
  format: z.enum(['pdf', 'png']).default('pdf'),
  size: z.enum(['full', 'thumb']).default('full'),
});

/** GET /api/dashboard?range= */
export const dashboardQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
});

/**
 * The fixed certificate templates (backend/src/templates/certificates/).
 * Template choice is per-course — every certificate issued for a course
 * renders with that course's template — not per-organization or per-cert.
 */
export const CERTIFICATE_TEMPLATES = ['classic', 'modern', 'editorial'];

/**
 * POST /api/courses — inline course creation from the typeahead, or the
 * explicit "New course" flow on /issuer/courses. `certificateTemplate` is
 * optional and only applied when a NEW course is actually inserted — the
 * idempotent existing-course path never overwrites one that's already set.
 */
export const createCourseSchema = z
  .object({
    name: hashableText('Course name', { min: 1, max: 200 }),
    certificateTemplate: z.enum(CERTIFICATE_TEMPLATES).optional(),
  })
  .strict();

/** PATCH /api/courses/:id/template */
export const updateCourseTemplateSchema = z
  .object({
    certificateTemplate: z.enum(CERTIFICATE_TEMPLATES),
  })
  .strict();
