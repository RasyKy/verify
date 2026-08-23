/**
 * Holder dashboard (FR-HOLD-01 through 06): the signed-in holder's own
 * certificates, plus visibility controls over them and their profile.
 */
import { Router } from 'express';

import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import {
  requireAuth as defaultRequireAuth,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { validateAll } from '../middleware/validate.js';
import { notFound } from '../lib/errors.js';
import { issuerStatus } from '../lib/derivedStatus.js';
import {
  certIdParamSchema,
  setCertVisibilitySchema,
  setProfileVisibilitySchema,
} from '../schemas/holder.js';

const HOLDER_CERT_SELECT = `
  id, course_name, completion_date, expiry_date,
  claim_state, revoked_at, is_hidden, created_at,
  organizations ( name ),
  certificate_hashes ( chain_issued_at, is_current )
`;

/**
 * Maps a row onto the shape the recipient dashboard renders
 * (frontend/app/composables/useHolderCertificates.ts). Status is derived,
 * never read from a column — `claim_state` will always be 'claimed' here
 * since holder_id is only ever set by the claim flow (routes/claim.js).
 */
function toHolderShape(row, now = new Date()) {
  const currentHash =
    (row.certificate_hashes ?? []).find((h) => h.is_current) ?? null;
  return {
    id: row.id,
    course_name: row.course_name,
    institution_name: row.organizations?.name ?? null,
    completion_date: row.completion_date,
    expiry_date: row.expiry_date,
    issued_at: row.created_at,
    issuedAtBlockchainTimestamp: currentHash?.chain_issued_at ?? null,
    status: issuerStatus(row, now),
    is_hidden: row.is_hidden,
  };
}

export function createHolderRouter({
  adminClient = defaultAdminClient,
  requireAuth = defaultRequireAuth,
} = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/holder/certificates:
   *   get:
   *     summary: The signed-in holder's own claimed certificates
   *     tags: [Holder]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: The caller's certificates, most recent first.
   *       401:
   *         description: Missing or invalid bearer token.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorResponse' }
   *       403:
   *         description: Caller is not a holder.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorResponse' }
   */
  router.get(
    '/holder/certificates',
    requireAuth,
    requireRole(ROLES.HOLDER),
    async (req, res, next) => {
      try {
        const rows = unwrap(
          await adminClient
            .from('certificates')
            .select(HOLDER_CERT_SELECT)
            .eq('holder_id', req.user.id)
            .order('created_at', { ascending: false }),
          'list holder certificates'
        );
        res.json((rows ?? []).map((row) => toHolderShape(row)));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/holder/certificates/{id}:
   *   patch:
   *     summary: Set whether one of the caller's certificates is hidden
   *     tags: [Holder]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated visibility.
   *       404:
   *         description: No such certificate belonging to the caller.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorResponse' }
   */
  router.patch(
    '/holder/certificates/:id',
    requireAuth,
    requireRole(ROLES.HOLDER),
    validateAll({ params: certIdParamSchema, body: setCertVisibilitySchema }),
    async (req, res, next) => {
      try {
        const { id } = req.validated.params;
        const { is_hidden } = req.validated.body;

        const owned = unwrap(
          await adminClient
            .from('certificates')
            .select('id')
            .eq('id', id)
            .eq('holder_id', req.user.id)
            .maybeSingle(),
          'load certificate for visibility update'
        );
        if (!owned) throw notFound('Certificate not found.');

        const updated = unwrap(
          await adminClient
            .from('certificates')
            .update({ is_hidden })
            .eq('id', id)
            .select('id, is_hidden')
            .maybeSingle(),
          'update certificate visibility'
        );
        res.json({ id: updated.id, is_hidden: updated.is_hidden });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/holder/profile:
   *   get:
   *     summary: The caller's own profile visibility setting
   *     tags: [Holder]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current profile_is_public value.
   */
  router.get(
    '/holder/profile',
    requireAuth,
    requireRole(ROLES.HOLDER),
    async (req, res, next) => {
      try {
        const row = unwrap(
          await adminClient
            .from('profiles')
            .select('profile_is_public')
            .eq('id', req.user.id)
            .maybeSingle(),
          'load profile visibility'
        );
        res.json({ profile_is_public: row.profile_is_public });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/holder/profile:
   *   patch:
   *     summary: Set whether the caller's profile is public
   *     tags: [Holder]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated profile_is_public value.
   */
  router.patch(
    '/holder/profile',
    requireAuth,
    requireRole(ROLES.HOLDER),
    validateAll({ body: setProfileVisibilitySchema }),
    async (req, res, next) => {
      try {
        // requireAuth already loaded this exact profile row via loadProfile
        // before setting req.user, so its existence is already proven — no
        // SELECT-then-check needed. profile_is_public isn't one of the
        // columns loadProfile's TTL cache selects, so no
        // invalidateProfileCache() call is needed either.
        const updated = unwrap(
          await adminClient
            .from('profiles')
            .update({ profile_is_public: req.validated.body.profile_is_public })
            .eq('id', req.user.id)
            .select('profile_is_public')
            .maybeSingle(),
          'update profile visibility'
        );
        res.json({ profile_is_public: updated.profile_is_public });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const holderRouter = createHolderRouter();
