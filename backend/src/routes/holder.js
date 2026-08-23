/**
 * Holder dashboard — read-only (FR-HOLD-01/02/03).
 *
 * Deliberately scoped: this returns only what a signed-in holder is entitled
 * to see about their OWN certificates. No PATCH/write endpoint exists here —
 * profile_is_public and is_hidden stay whatever they already are. Wiring
 * writes for those is a separate, later change (FR-HOLD-04/05/06).
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
import { issuerStatus } from '../lib/derivedStatus.js';

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

  return router;
}

export const holderRouter = createHolderRouter();
