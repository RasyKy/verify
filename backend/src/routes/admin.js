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

import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth, requireRole, ROLES } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AUDIT_ACTIONS, writeAuditEvent } from '../services/audit.js';
import { certificateService as defaultCertificateService } from '../services/certificate.js';
import { blockchainService as defaultChain } from '../services/blockchain.js';
import {
  adminRevokeSchema,
  createIssuerSchema,
  createOrganizationSchema,
  slugify,
  adminIssueCertificateSchema,
  adminUpdateCertificateSchema,
  updateOrganizationSchema,
  updateUserSchema,
} from '../schemas/admin.js';

/** DB `user_role` → the union the admin portal renders. */
function toAdminRole(role) {
  return role === 'holder' ? 'recipient' : role;
}

export function createAdminRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
  audit = writeAuditEvent,
  certificateService = defaultCertificateService,
  chain = defaultChain,
} = {}) {
  const router = Router();
  const adminOnly = [auth, requireRole(ROLES.ADMIN)];

  /**
   * @openapi
   * /api/admin/organizations:
   *   get:
   *     summary: All institutions, with issuer and certificate counts
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of institutions
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/organizations', ...adminOnly, async (_req, res, next) => {
    try {
      const orgs = unwrap(
        await adminClient
          .from('organizations')
          .select(
            'id, name, slug, type, website, logo_url, status, accredited, created_at'
          )
          .order('created_at', { ascending: false }),
        'list organizations'
      );

      // Two grouped reads rather than a count per organization, which would be
      // one query per row.
      const [issuers, certs] = await Promise.all([
        adminClient
          .from('profiles')
          .select('organization_id')
          .eq('role', 'issuer'),
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
          logoUrl: org.logo_url ?? null,
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
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Institution created
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: An institution with that slug already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       422:
   *         description: Validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/organizations',
    ...adminOnly,
    validate(createOrganizationSchema),
    async (req, res, next) => {
      const { name, type, website, logoUrl, accredited } = req.validated.body;
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
          throw conflict(
            `An institution with the slug "${slug}" already exists.`
          );
        }

        const org = unwrap(
          await adminClient
            .from('organizations')
            .insert({
              name,
              slug,
              type,
              website: website ?? null,
              logo_url: logoUrl ?? null,
              accredited,
            })
            .select('id, name, slug, type, website, logo_url, status, created_at')
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
          logoUrl: org.logo_url ?? null,
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
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of accounts
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Issuer account created
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an admin
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: An account with that email already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       422:
   *         description: Validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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

  // ── Platform overview ─────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/stats:
   *   get:
   *     summary: Platform-wide counts and the 6-month issuance series
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Overview figures
   */
  router.get('/stats', ...adminOnly, async (_req, res, next) => {
    try {
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      // Six calendar months back, from the first of that month, so the series
      // covers whole months rather than a ragged 180-day window.
      const seriesStart = new Date();
      seriesStart.setUTCDate(1);
      seriesStart.setUTCHours(0, 0, 0, 0);
      seriesStart.setUTCMonth(seriesStart.getUTCMonth() - 5);

      // `head: true` with an exact count asks Postgres for the number only —
      // no rows cross the wire, which matters once a table has real volume.
      const countOf = (table, apply = (q) => q) =>
        apply(adminClient.from(table).select('id', { count: 'exact', head: true }));

      const [orgs, certs, issuers, verifications, series] = await Promise.all([
        countOf('organizations'),
        countOf('certificates'),
        countOf('profiles', (q) => q.eq('role', 'issuer').eq('status', 'active')),
        countOf('verification_logs', (q) => q.gte('created_at', since30)),
        adminClient
          .from('certificates')
          .select('created_at')
          .gte('created_at', seriesStart.toISOString()),
      ]);

      // Pre-seed every month at zero. Deriving the buckets from the rows would
      // silently drop a quiet month and leave the chart with uneven spacing.
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const buckets = new Map();
      for (let i = 0; i < 6; i += 1) {
        const d = new Date(seriesStart);
        d.setUTCMonth(d.getUTCMonth() + i);
        buckets.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, {
          month: MONTHS[d.getUTCMonth()],
          count: 0,
        });
      }
      for (const row of series.data ?? []) {
        const d = new Date(row.created_at);
        const bucket = buckets.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
        if (bucket) bucket.count += 1;
      }

      res.json({
        totalOrgs: orgs.count ?? 0,
        totalCerts: certs.count ?? 0,
        activeIssuers: issuers.count ?? 0,
        verificationsLast30: verifications.count ?? 0,
        monthlyCerts: [...buckets.values()],
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Certificates, platform-wide ───────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/certificates:
   *   get:
   *     summary: Every certificate on the platform, across all institutions
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Certificate list
   */
  router.get('/certificates', ...adminOnly, async (_req, res, next) => {
    try {
      const rows = unwrap(
        await adminClient
          .from('certificates')
          .select(
            `id, student_name, student_email, course_name, organization_id,
             created_at, revoked_at, organizations ( name )`
          )
          .order('created_at', { ascending: false })
          .limit(500),
        'list all certificates'
      );

      res.json(
        (rows ?? []).map((row) => ({
          id: row.id,
          recipientName: row.student_name,
          recipientEmail: row.student_email,
          courseName: row.course_name,
          organizationId: row.organization_id,
          organizationName: row.organizations?.name ?? '—',
          issuedAt: row.created_at,
          // adminStatus() in lib/derivedStatus.js: this table's union is only
          // issued/revoked — expiry is not a distinction it draws.
          status: row.revoked_at ? 'revoked' : 'issued',
          revokedAt: row.revoked_at ?? undefined,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/admin/certificates/{id}/revoke:
   *   post:
   *     summary: Revoke any certificate, regardless of issuing institution
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/certificates/:id/revoke',
    ...adminOnly,
    validate(adminRevokeSchema),
    async (req, res, next) => {
      try {
        /*
         * Same service the issuer route uses, so the chain write, the hash row
         * update and the revoked_at stamp stay in one implementation — the
         * difference is only who is permitted to ask. An admin carries no
         * organizationId, and revoke() reads that as "not scoped to one org",
         * which is exactly the platform-wide reach this route needs.
         *
         * No audit call here: revoke() already writes CERTIFICATE_REVOKED
         * itself, and a second one would put the same act in the log twice.
         */
        const result = await certificateService.revoke({
          id: req.params.id,
          reason:
            req.validated.body.reason ?? 'Revoked by platform administrator.',
          user: req.user,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/certificates/{id}:
   *   delete:
   *     summary: Permanently erase a certificate record
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.delete(
    '/certificates/:id',
    ...adminOnly,
    async (req, res, next) => {
      try {
        const row = unwrap(
          await adminClient
            .from('certificates')
            .select('id, student_name, course_name, organization_id, revoked_at')
            .eq('id', req.params.id)
            .maybeSingle(),
          'load certificate for delete'
        );
        if (!row) throw notFound('Certificate not found.');

        /*
         * Revoke on chain first, unless it already is.
         *
         * The hash cannot be erased from the registry — nothing can erase it.
         * So deleting the row alone would leave a hash that still reads as
         * ISSUED on chain while the database has no record of it, and the
         * public verify path would answer `invalid`: the wording reserved for
         * forgery. Revoking first makes the permanent half of the record tell
         * the truth about what happened.
         */
        if (!row.revoked_at) {
          const current = await certificateService.currentHashRow(row.id);
          if (current) await chain.revoke(current.hash);
        }

        // certificate_hashes, claim_tokens and expiry_notifications are ON
        // DELETE CASCADE; verification_logs is ON DELETE SET NULL, so the
        // record that someone checked this ID survives the certificate.
        unwrap(
          await adminClient.from('certificates').delete().eq('id', row.id),
          'delete certificate'
        );

        await audit({
          action: AUDIT_ACTIONS.CERTIFICATE_REVOKED,
          targetLabel: `${row.student_name} — ${row.course_name} (deleted)`,
          actor: req.user,
          organizationId: row.organization_id ?? null,
          metadata: { certificate_id: row.id, deleted: true },
        });

        res.json({ id: row.id, deleted: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // ── Audit log ─────────────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/audit:
   *   get:
   *     summary: Platform audit trail, newest first
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/audit', ...adminOnly, async (_req, res, next) => {
    try {
      const rows = unwrap(
        await adminClient
          .from('audit_events')
          .select(
            `id, actor_name, actor_email, action, target_label,
             organization_id, created_at, organizations ( name )`
          )
          .order('created_at', { ascending: false })
          .limit(200),
        'list audit events'
      );

      res.json(
        (rows ?? []).map((row) => ({
          id: row.id,
          timestamp: row.created_at,
          // The denormalised columns survive the actor being deleted; fall back
          // rather than render an empty row.
          actorName: row.actor_name ?? 'Deleted user',
          actorEmail: row.actor_email ?? '',
          action: row.action,
          targetLabel: row.target_label,
          organizationId: row.organization_id ?? '',
          organizationName: row.organizations?.name ?? '—',
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  // ── Status changes ────────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/organizations/{id}:
   *   patch:
   *     summary: Suspend or reactivate an institution
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/organizations/:id',
    ...adminOnly,
    validate(updateOrganizationSchema),
    async (req, res, next) => {
      try {
        const { name, type, status, website, logoUrl, accredited } =
          req.validated.body;

        // Only the keys actually sent are written, so a status change does not
        // blank the logo and a logo change does not reactivate a suspension.
        const patch = {};
        if (name !== undefined) patch.name = name;
        if (type !== undefined) patch.type = type;
        if (status !== undefined) patch.status = status;
        if (website !== undefined) patch.website = website;
        if (logoUrl !== undefined) patch.logo_url = logoUrl;
        if (accredited !== undefined) patch.accredited = accredited;

        const rows = unwrap(
          await adminClient
            .from('organizations')
            .update(patch)
            .eq('id', req.params.id)
            .select('id, name, type, website, logo_url, status, accredited'),
          'update organization'
        );

        const org = rows?.[0];
        if (!org) throw notFound('Organization not found.');

        // Only a status flip is an auditable act; editing a logo is not.
        if (status !== undefined) {
          await audit({
            action:
              status === 'suspended'
                ? AUDIT_ACTIONS.ORG_SUSPENDED
                : AUDIT_ACTIONS.ORG_REACTIVATED,
            targetLabel: org.name,
            actor: req.user,
            organizationId: org.id,
            metadata: {},
          });
        }

        res.json({
          id: org.id,
          name: org.name,
          type: org.type,
          status: org.status,
          website: org.website ?? '',
          logoUrl: org.logo_url ?? null,
          accredited: org.accredited,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/users/{id}:
   *   patch:
   *     summary: Deactivate or reactivate an account
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/users/:id',
    ...adminOnly,
    validate(updateUserSchema),
    async (req, res, next) => {
      try {
        const { status, fullName, organizationId } = req.validated.body;

        // An admin who deactivates themselves would be locked out with no way
        // back in, since reactivating requires an admin.
        if (req.params.id === req.user.id && status === 'deactivated') {
          throw badRequest('You cannot deactivate your own account.');
        }

        // Only the keys sent are written, so renaming someone does not also
        // reactivate them.
        const patch = {};
        if (status !== undefined) patch.status = status;
        if (fullName !== undefined) patch.full_name = fullName;
        if (organizationId !== undefined) patch.organization_id = organizationId;

        const rows = unwrap(
          await adminClient
            .from('profiles')
            .update(patch)
            .eq('id', req.params.id)
            .select('id, full_name, email, role, status, organization_id'),
          'update user'
        );

        const user = rows?.[0];
        if (!user) throw notFound('User not found.');

        // Only a status flip is auditable; a rename is not.
        if (status !== undefined) {
          await audit({
            action:
              status === 'deactivated'
                ? AUDIT_ACTIONS.ISSUER_REMOVED
                : AUDIT_ACTIONS.ISSUER_INVITED,
            targetLabel: user.full_name ?? user.email,
            actor: req.user,
            organizationId: user.organization_id ?? null,
            metadata: { user_id: user.id, status },
          });
        }

        res.json({
          id: user.id,
          name: user.full_name ?? user.email,
          email: user.email,
          role: toAdminRole(user.role),
          status: user.status,
          organizationId: user.organization_id ?? '',
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/certificates:
   *   post:
   *     summary: Issue a certificate on behalf of any institution
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/certificates',
    ...adminOnly,
    validate(adminIssueCertificateSchema),
    async (req, res, next) => {
      try {
        const { organizationId, ...input } = req.validated.body;

        /*
         * The service reads the institution off the acting user, which is how
         * an issuer is confined to their own. An admin has none, so it acts as
         * a caller scoped to the named institution for this one call. issuer_id
         * stays the admin's own id — they did issue it, and the audit trail
         * should not pretend otherwise.
         */
        const result = await certificateService.issue({
          input,
          user: { ...req.user, organizationId },
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/certificates/{id}:
   *   put:
   *     summary: Correct a certificate, re-anchoring it on chain
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '/certificates/:id',
    ...adminOnly,
    validate(adminUpdateCertificateSchema),
    async (req, res, next) => {
      try {
        // Which institution owns it decides the scope the service runs under.
        const row = unwrap(
          await adminClient
            .from('certificates')
            .select('id, organization_id')
            .eq('id', req.params.id)
            .maybeSingle(),
          'load certificate for update'
        );
        if (!row) throw notFound('Certificate not found.');

        const result = await certificateService.update({
          id: req.params.id,
          input: req.validated.body,
          user: { ...req.user, organizationId: row.organization_id },
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/users/{id}:
   *   delete:
   *     summary: Permanently remove an account
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/users/:id', ...adminOnly, async (req, res, next) => {
    try {
      if (req.params.id === req.user.id) {
        throw badRequest('You cannot delete your own account.');
      }

      const profile = unwrap(
        await adminClient
          .from('profiles')
          .select('id, full_name, email, organization_id')
          .eq('id', req.params.id)
          .maybeSingle(),
        'load user for delete'
      );
      if (!profile) throw notFound('User not found.');

      /*
       * Delete the auth user, not the profile: profiles.id is a foreign key
       * onto auth.users with ON DELETE CASCADE, so removing the auth record
       * takes the profile with it. Deleting the profile alone would leave an
       * account that can still sign in with nothing behind it.
       *
       * audit_events.actor_id is ON DELETE SET NULL and carries denormalised
       * actor_name/actor_email, so the trail of what they did survives.
       */
      const { error } = await adminClient.auth.admin.deleteUser(profile.id);
      if (error) throw badRequest(`Could not delete the account: ${error.message}`);

      await audit({
        action: AUDIT_ACTIONS.ISSUER_REMOVED,
        targetLabel: `${profile.full_name ?? profile.email} (deleted)`,
        actor: req.user,
        organizationId: profile.organization_id ?? null,
        metadata: { user_id: profile.id, deleted: true },
      });

      res.json({ id: profile.id, deleted: true });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/admin/organizations/{id}:
   *   delete:
   *     summary: Remove an institution that has no issuers or certificates
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/organizations/:id', ...adminOnly, async (req, res, next) => {
    try {
      const org = unwrap(
        await adminClient
          .from('organizations')
          .select('id, name')
          .eq('id', req.params.id)
          .maybeSingle(),
        'load organization for delete'
      );
      if (!org) throw notFound('Organization not found.');

      /*
       * Both profiles.organization_id and certificates.organization_id are ON
       * DELETE RESTRICT, so Postgres would refuse this anyway — but it would
       * refuse with a foreign-key violation. Checking first turns that into a
       * message that says which of the two is in the way, and how many.
       */
      const [issuers, certs] = await Promise.all([
        adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        adminClient
          .from('certificates')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
      ]);

      const blockers = [];
      if (issuers.count) blockers.push(`${issuers.count} account(s)`);
      if (certs.count) blockers.push(`${certs.count} certificate(s)`);
      if (blockers.length) {
        throw conflict(
          `${org.name} still has ${blockers.join(' and ')}. Remove those first, or suspend the institution instead.`
        );
      }

      unwrap(
        await adminClient.from('organizations').delete().eq('id', org.id),
        'delete organization'
      );

      await audit({
        action: AUDIT_ACTIONS.ORG_SUSPENDED,
        targetLabel: `${org.name} (deleted)`,
        actor: req.user,
        organizationId: null,
        metadata: { organization_id: org.id, deleted: true },
      });

      res.json({ id: org.id, deleted: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const adminRouter = createAdminRouter();
