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
    password: z.string().min(8, 'must be at least 8 characters').max(200).optional(),
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
