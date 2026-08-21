/**
 * Claim-flow endpoints (FR-CLAIM-01..04, T-02).
 *
 *   GET  /api/claim/:token           PUBLIC  preview — is this link usable?
 *   POST /api/claim/:token/confirm   holder  redeem — link the cert to a
 *                                            Supabase account, mark it claimed
 *
 * The confirm route does NOT sit behind `requireAuth`: a holder who just
 * self-registered via Supabase on the claim page (Google/OTP/password — see
 * frontend/app/pages/claim/[token].vue) has a valid JWT but no `profiles` row
 * yet, and `requireAuth` rejects with 403 when a profile is missing
 * (middleware/auth.js). This route verifies the JWT itself
 * (`verifyBearerToken`) and provisions the holder's profile row inline —
 * it is the flow that is meant to create that row in the first place.
 *
 * Built as a factory so tests inject fakes — jest.mock() does not work under
 * this project's native-ESM Jest (see backend/README.md).
 */
import crypto from 'node:crypto';

import { Router } from 'express';

import { adminClient as defaultAdminClient, unwrap } from '../config/supabase.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { verifyBearerToken as defaultVerifyBearerToken } from '../middleware/auth.js';
import { claimLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { claimTokenParamSchema } from '../schemas/claim.js';
import { AUDIT_ACTIONS, writeAuditEvent as defaultAudit } from '../services/audit.js';

/** sha256 of the raw token. Only the digest is ever stored or looked up. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const EMPTY_PREVIEW = {
  valid: false,
  expired: false,
  used: false,
  studentName: '',
  courseName: '',
  institutionName: '',
  email: '',
};

async function loadClaimContext(adminClient, token) {
  const tokenRow = unwrap(
    await adminClient
      .from('claim_tokens')
      .select('id, certificate_id, expires_at, used_at, sent_to')
      .eq('token_hash', hashToken(token))
      .maybeSingle(),
    'load claim token'
  );
  if (!tokenRow) return null;

  const cert = unwrap(
    await adminClient
      .from('certificates')
      .select(
        'id, student_name, student_email, course_name, holder_id, claim_state, organizations ( name )'
      )
      .eq('id', tokenRow.certificate_id)
      .maybeSingle(),
    'load certificate for claim'
  );

  return { tokenRow, cert };
}

export function createClaimRouter({
  adminClient = defaultAdminClient,
  verifyBearerToken = defaultVerifyBearerToken,
  audit = defaultAudit,
} = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/claim/{token}:
   *   get:
   *     summary: Preview a claim link without redeeming it
   *     tags: [Claim]
   *     security: []
   */
  router.get(
    '/claim/:token',
    claimLimiter,
    validate(claimTokenParamSchema, 'params'),
    async (req, res, next) => {
      try {
        const { token } = req.validated.params;
        const context = await loadClaimContext(adminClient, token);

        if (!context) {
          return res.json(EMPTY_PREVIEW);
        }

        const { tokenRow, cert } = context;
        const used = tokenRow.used_at != null;
        const expired = new Date(tokenRow.expires_at).getTime() < Date.now();

        res.json({
          valid: !used && !expired,
          expired,
          used,
          studentName: cert.student_name,
          courseName: cert.course_name,
          institutionName: cert.organizations?.name ?? '',
          email: tokenRow.sent_to,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/claim/{token}/confirm:
   *   post:
   *     summary: Redeem a claim link and link the certificate to the caller's account
   *     tags: [Claim]
   */
  router.post(
    '/claim/:token/confirm',
    claimLimiter,
    validate(claimTokenParamSchema, 'params'),
    async (req, res, next) => {
      try {
        const { token } = req.validated.params;
        const { userId, email } = await verifyBearerToken(req);

        const context = await loadClaimContext(adminClient, token);
        if (!context) throw notFound('This claim link is not valid.');

        const { tokenRow, cert } = context;

        if (tokenRow.used_at) {
          throw conflict('This claim link has already been used.');
        }
        if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
          throw conflict('This claim link has expired.');
        }

        // Server-side re-check: the frontend only verifies this for the OAuth
        // path, client-side. A bearer token for the wrong email must not be
        // able to claim someone else's certificate by hitting this route
        // directly.
        if (
          !email ||
          email.trim().toLowerCase() !== tokenRow.sent_to.trim().toLowerCase()
        ) {
          throw forbidden(
            'This certificate must be claimed with the email it was issued to.'
          );
        }

        const profile = unwrap(
          await adminClient
            .from('profiles')
            .select('id, role')
            .eq('id', userId)
            .maybeSingle(),
          'load profile for claim'
        );

        if (!profile) {
          unwrap(
            await adminClient.from('profiles').insert({
              id: userId,
              email,
              full_name: cert.student_name,
              role: 'holder',
              organization_id: null,
              status: 'active',
            }),
            'provision holder profile'
          );
        } else if (profile.role !== 'holder') {
          throw forbidden('This account cannot claim certificates.');
        }

        unwrap(
          await adminClient
            .from('certificates')
            .update({
              holder_id: userId,
              claim_state: 'claimed',
              claimed_at: new Date().toISOString(),
            })
            .eq('id', cert.id),
          'link certificate to holder'
        );

        unwrap(
          await adminClient
            .from('claim_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', tokenRow.id),
          'mark claim token used'
        );

        await audit({
          action: AUDIT_ACTIONS.CERTIFICATE_CLAIMED,
          targetLabel: cert.student_name,
          actor: { id: userId, email, fullName: cert.student_name },
          organizationId: null,
          metadata: { certificateId: cert.id },
        });

        res.status(200).json({ success: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

/** Default instance wired to the real clients. */
export const claimRouter = createClaimRouter();
