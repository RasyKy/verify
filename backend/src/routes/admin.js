/**
 * Admin endpoints — the subset the demo flow cannot start without.
 *
 *   GET  /api/admin/organizations
 *   POST /api/admin/organizations        FR-INST-02
 *   GET  /api/admin/users
 *   POST /api/admin/users                FR-AUTH-01 — creates an issuer
 *
 * Nothing else can create an issuer account, so this is the first link in the
 * chain: admin makes an org and an issuer, the issuer signs in and issues.
 * The remaining admin surface (stats, suspend/reactivate, platform
 * certificates, audit) is deliberately not here yet.
 *
 * Responses use the camelCase, denormalised shapes from
 * frontend/app/composables/useAdminMockData.ts, and map the database's `holder`
 * role to the frontend's `recipient` label at this boundary.
 */
import crypto from 'node:crypto';

import { Router } from 'express';

import { adminClient as defaultAdminClient, unwrap } from '../config/supabase.js';
import { badRequest, conflict } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth, requireRole, ROLES } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AUDIT_ACTIONS, writeAuditEvent } from '../services/audit.js';
import {
  createIssuerSchema,
  createOrganizationSchema,
  slugify,
} from '../schemas/admin.js';

/** DB `user_role` → the union the admin portal renders. */
function toAdminRole(role) {
  return role === 'holder' ? 'recipient' : role;
}

export function createAdminRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
  audit = writeAuditEvent,
} = {}) {
  const router = Router();
  const adminOnly = [auth, requireRole(ROLES.ADMIN)];

  /**
   * @openapi
   * /api/admin/organizations:
   *   get:
   *     summary: All institutions, with issuer and certificate counts
   *     tags: [Admin]
   */
  router.get('/organizations', ...adminOnly, async (_req, res, next) => {
    try {
      const orgs = unwrap(
        await adminClient
          .from('organizations')
          .select('id, name, slug, type, website, status, accredited, created_at')
          .order('created_at', { ascending: false }),
        'list organizations'
      );

      // Two grouped reads rather than a count per organization, which would be
      // one query per row.
      const [issuers, certs] = await Promise.all([
        adminClient.from('profiles').select('organization_id').eq('role', 'issuer'),
        adminClient.from('certificates').select('organization_id'),
      ]);

      const countBy = (result) => {
        const map = new Map();
        for (const row of result.data ?? []) {
          map.set(row.organization_id, (map.get(row.organization_id) ?? 0) + 1);
        }
        return map;
      };
      const issuerCounts = countBy(issuers);
      const certCounts = countBy(certs);

      res.json(
        (orgs ?? []).map((org) => ({
          id: org.id,
          name: org.name,
          type: org.type,
          website: org.website ?? '',
          issuersCount: issuerCounts.get(org.id) ?? 0,
          certificatesCount: certCounts.get(org.id) ?? 0,
          status: org.status,
          createdAt: org.created_at,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/admin/organizations:
   *   post:
   *     summary: Register an institution
   *     tags: [Admin]
   */
  router.post(
    '/organizations',
    ...adminOnly,
    validate(createOrganizationSchema),
    async (req, res, next) => {
      const { name, type, website, accredited } = req.validated.body;
      const slug = req.validated.body.slug ?? slugify(name);

      if (!slug) {
        throw badRequest(
          'Could not derive a slug from that name — please supply one.'
        );
      }

      try {
        const existing = unwrap(
          await adminClient
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .maybeSingle(),
          'check organization slug'
        );
        if (existing) {
          throw conflict(`An institution with the slug "${slug}" already exists.`);
        }

        const org = unwrap(
          await adminClient
            .from('organizations')
            .insert({
              name,
              slug,
              type,
              website: website ?? null,
              accredited,
            })
            .select('id, name, slug, type, website, status, created_at')
            .single(),
          'create organization'
        );

        await audit({
          action: AUDIT_ACTIONS.ORG_CREATED,
          targetLabel: org.name,
          actor: req.user,
          organizationId: org.id,
          metadata: { slug: org.slug, type: org.type },
        });

        res.status(201).json({
          id: org.id,
          name: org.name,
          type: org.type,
          website: org.website ?? '',
          issuersCount: 0,
          certificatesCount: 0,
          status: org.status,
          createdAt: org.created_at,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/users:
   *   get:
   *     summary: All platform accounts
   *     tags: [Admin]
   */
  router.get('/users', ...adminOnly, async (_req, res, next) => {
    try {
      const rows = unwrap(
        await adminClient
          .from('profiles')
          .select(
            'id, email, full_name, role, status, created_at, organization_id, organizations ( name )'
          )
          .order('created_at', { ascending: false }),
        'list users'
      );

      res.json(
        (rows ?? []).map((row) => ({
          id: row.id,
          name: row.full_name ?? row.email,
          email: row.email,
          role: toAdminRole(row.role),
          organizationId: row.organization_id ?? '',
          organizationName: row.organizations?.name ?? '',
          status: row.status === 'active' ? 'active' : 'deactivated',
          joinedAt: row.created_at,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/admin/users:
   *   post:
   *     summary: Create an issuer account (FR-AUTH-01)
   *     tags: [Admin]
   */
  router.post(
    '/users',
    ...adminOnly,
    validate(createIssuerSchema),
    async (req, res, next) => {
      const { email, fullName, organizationId } = req.validated.body;
      // A generated password is never shown to the admin — the issuer sets their
      // own through Supabase's reset flow. Handing an admin a colleague's
      // password makes every later action by that account deniable (T-08).
      const password =
        req.validated.body.password ?? `${crypto.randomUUID()}Aa1!`;

      let createdUserId = null;
      try {
        const org = unwrap(
          await adminClient
            .from('organizations')
            .select('id, name')
            .eq('id', organizationId)
            .maybeSingle(),
          'load organization'
        );
        if (!org) throw badRequest('That institution does not exist.');

        // Role goes in app_metadata, which only the service key can write.
        // Putting it in user_metadata would let the issuer promote themselves
        // to admin via auth.updateUser() (T-01).
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role: 'issuer' },
          user_metadata: { full_name: fullName, institution_name: org.name },
        });
        if (error) {
          if (/already|exists|registered/i.test(error.message ?? '')) {
            throw conflict('An account with that email already exists.');
          }
          throw error;
        }
        createdUserId = data.user.id;

        const profile = unwrap(
          await adminClient
            .from('profiles')
            .insert({
              id: createdUserId,
              email,
              full_name: fullName,
              role: 'issuer',
              organization_id: organizationId,
            })
            .select('id, email, full_name, role, status, created_at')
            .single(),
          'create profile'
        );

        await audit({
          action: AUDIT_ACTIONS.ISSUER_INVITED,
          targetLabel: fullName,
          actor: req.user,
          organizationId,
          metadata: { email, userId: createdUserId },
        });

        res.status(201).json({
          id: profile.id,
          name: profile.full_name,
          email: profile.email,
          role: 'issuer',
          organizationId,
          organizationName: org.name,
          status: 'active',
          joinedAt: profile.created_at,
        });
      } catch (err) {
        // An auth user with no profile row can authenticate but is refused
        // everywhere (middleware/auth.js treats a missing profile as 403), which
        // is a confusing dead account. Roll it back.
        if (createdUserId) {
          try {
            await adminClient.auth.admin.deleteUser(createdUserId);
          } catch (cleanupErr) {
            logger.error('could not roll back orphaned auth user', {
              err: cleanupErr,
              userId: createdUserId,
            });
          }
        }
        next(err);
      }
    }
  );

  return router;
}

export const adminRouter = createAdminRouter();
