/**
 * Admin request schemas.
 *
 * Shapes mirror the `Org` / `AdminUser` interfaces at the top of
 * frontend/app/composables/useAdminMockData.ts, so the admin portal can swap
 * that composable for real calls without touching its components.
 */
import { z } from 'zod';

import { email, hashableText } from './common.js';

/** Mirrors the `org_type` enum and the Org.type union on the frontend. */
export const ORG_TYPES = Object.freeze([
  'university',
  'bootcamp',
  'professional-body',
  'event',
]);

/**
 * POST /api/admin/organizations — FR-INST-02.
 *
 * `slug` is derived from the name when omitted. It is what appears in support
 * conversations and future public URLs, so it is normalised rather than
 * accepted as typed.
 */
export const createOrganizationSchema = z
  .object({
    name: hashableText('Organization name', { min: 2, max: 200 }),
    type: z.enum(ORG_TYPES),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'must be lowercase letters, numbers and single hyphens'
      )
      .max(80)
      .optional(),
    website: z.string().trim().max(200).optional(),
    // A path under frontend/public (e.g. /rupp-logo.png) or an absolute URL.
    logoUrl: z.string().trim().max(300).optional(),
    accredited: z.boolean().default(false),
  })
  .strict();

/**
 * POST /api/admin/users — FR-AUTH-01.
 *
 * This is the ONLY way an issuer account comes into being: there is no public
 * sign-up for issuers, because an issuer can attest that someone graduated.
 * Self-registration would make the institution registry meaningless.
 */
export const createIssuerSchema = z
  .object({
    email,
    fullName: hashableText('Full name', { min: 2, max: 120 }),
    organizationId: z.uuid('organizationId must be a UUID'),
    // Optional so the admin can let the platform generate one and have the
    // issuer reset it, rather than inventing a weak password and emailing it.
    password: z
      .string()
      .min(8, 'must be at least 8 characters')
      .max(200)
      .optional(),
  })
  .strict();

/**
 * PATCH /api/admin/organizations/:id — FR-INST-03.
 *
 * Suspension is the only field an admin flips here, and it is deliberately a
 * status change rather than a delete: certificates already issued under a
 * suspended institution stay verifiable, because revoking them would punish the
 * graduates for their institution's conduct.
 */
export const updateOrganizationSchema = z
  .object({
    name: hashableText('Organization name', { min: 2, max: 200 }).optional(),
    type: z.enum(ORG_TYPES).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    website: z.string().trim().max(200).optional(),
    logoUrl: z.string().trim().max(300).nullable().optional(),
    accredited: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });

/**
 * PATCH /api/admin/users/:id — FR-AUTH-06.
 *
 * Deactivation, not deletion. `profiles.id` is a foreign key onto auth.users
 * and audit_events references the actor, so removing the row would either fail
 * or erase the trail of what that account did.
 */
export const updateUserSchema = z
  .object({
    fullName: hashableText('Full name', { min: 2, max: 120 }).optional(),
    status: z.enum(['active', 'deactivated']).optional(),
    // Moving an issuer between institutions. Certificates already issued keep
    // their original organization_id — the row records who issued it at the
    // time, and rewriting that would falsify history.
    organizationId: z.uuid('organizationId must be a UUID').nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });

/**
 * POST /api/admin/certificates.
 *
 * The issuer route takes the institution from the caller's own profile. An
 * admin belongs to none, so the organization has to be named explicitly —
 * `certificates.organization_id` is NOT NULL and there is no sensible default.
 */
export const adminIssueCertificateSchema = z
  .object({
    organizationId: z.uuid('organizationId must be a UUID'),
    studentName: hashableText('Student name', { min: 2, max: 120 }),
    studentEmail: email,
    courseName: hashableText('Course name', { min: 2, max: 200 }),
    completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .strict();

/** PUT /api/admin/certificates/:id — same fields, minus the institution. */
export const adminUpdateCertificateSchema = z
  .object({
    studentName: hashableText('Student name', { min: 2, max: 120 }),
    studentEmail: email,
    courseName: hashableText('Course name', { min: 2, max: 200 }),
    completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
      .nullable()
      .optional(),
  })
  .strict();

/**
 * POST /api/admin/certificates/:id/revoke.
 *
 * The issuer route carries its own reason field; this mirrors it so an
 * admin-initiated revocation records why, in the same shape.
 */
export const adminRevokeSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** Turns "Royal Phnom Penh University" into "royal-phnom-penh-university". */
export function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
