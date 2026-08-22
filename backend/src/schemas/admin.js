/**
 * Admin request schemas — account and institution management.
 *
 * These cover the operations only a platform admin may perform. The role is
 * enforced in the router (requireRole(ROLES.ADMIN)); these schemas exist to
 * make sure a malformed or hostile payload never reaches Supabase Auth or a
 * query.
 */
import { z } from 'zod';

import { email, hashableText } from './common.js';

/** Mirrors the org_type enum in 0001_init.sql. */
export const ORG_TYPES = Object.freeze([
  'university',
  'bootcamp',
  'professional-body',
  'event',
]);

/**
 * POST /api/admin/users — invite an issuer (or another admin).
 *
 * `holder` is deliberately absent. Holders are created by the claim flow when
 * a recipient claims a certificate, never provisioned by an admin — offering
 * it here would produce accounts with no certificate attached to them.
 *
 * `organizationId` is required for an issuer and rejected for an admin, which
 * mirrors the `profiles_org_required_for_issuer` constraint in the database.
 * Catching it here turns an opaque 23514 constraint violation into a field
 * error the admin UI can render next to the input.
 */
export const inviteUserSchema = z
  .object({
    email,
    fullName: hashableText('Full name', { min: 2, max: 120 }),
    role: z.enum(['issuer', 'admin']).default('issuer'),
    organizationId: z.uuid('organizationId must be a UUID').nullish(),
  })
  .strict()
  .refine((data) => data.role !== 'issuer' || Boolean(data.organizationId), {
    message: 'An issuer must be linked to an institution',
    path: ['organizationId'],
  })
  .refine((data) => data.role !== 'admin' || !data.organizationId, {
    message: 'A platform admin does not belong to an institution',
    path: ['organizationId'],
  })
  .transform((data) => ({
    ...data,
    organizationId: data.organizationId ?? null,
  }));

/** GET /api/admin/users */
export const listUsersSchema = z.object({
  role: z.enum(['admin', 'issuer', 'holder']).optional(),
  status: z.enum(['active', 'deactivated']).optional(),
  organizationId: z.uuid().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * PATCH /api/admin/users/:id — deactivate or reactivate.
 *
 * Status only. Changing a role after the fact would move certificates between
 * authorization scopes in ways the audit trail cannot express cleanly; delete
 * and re-invite instead.
 */
export const updateUserStatusSchema = z
  .object({
    status: z.enum(['active', 'deactivated']),
  })
  .strict();

/** POST /api/admin/organizations */
export const createOrganizationSchema = z
  .object({
    name: hashableText('Institution name', { min: 2, max: 200 }),
    type: z.enum(ORG_TYPES),
    // Lowercase, URL-safe, and unique in the database. Generated from the name
    // when omitted so the admin UI does not have to ask for it.
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug may contain only lowercase letters, numbers and hyphens'
      )
      .max(80)
      .optional(),
    website: z.url('Website must be a valid URL').max(500).nullish(),
    accredited: z.boolean().default(false),
  })
  .strict();

/** GET /api/admin/organizations */
export const listOrganizationsSchema = z.object({
  status: z.enum(['active', 'suspended']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** PATCH /api/admin/organizations/:id */
export const updateOrganizationStatusSchema = z
  .object({
    status: z.enum(['active', 'suspended']),
  })
  .strict();
