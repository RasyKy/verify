/**
 * Holder dashboard (FR-HOLD-01 through 06): the signed-in holder's own
 * certificates, plus visibility controls over them and their profile.
 *
 * Also serves the PUBLIC profile those controls govern
 * (GET /api/profiles/:holderId). Until that endpoint existed, `is_hidden` and
 * `profile_is_public` were written by the routes below and read by nothing —
 * the toggles stored a preference no surface consulted, so a "hidden"
 * certificate was hidden from no one.
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
import { publicProfileLimiter } from '../middleware/rateLimit.js';
import { notFound } from '../lib/errors.js';
import { issuerStatus } from '../lib/derivedStatus.js';
import {
  certIdParamSchema,
  holderIdParamSchema,
  setCertVisibilitySchema,
  setProfileVisibilitySchema,
} from '../schemas/holder.js';

const HOLDER_CERT_SELECT = `
  id, course_name, completion_date, expiry_date,
  claim_state, revoked_at, is_hidden, created_at,
  organizations ( name ),
  courses ( badge_url ),
  certificate_hashes ( chain_issued_at, is_current )
`;

/**
 * The public profile's columns. Deliberately narrower than
 * HOLDER_CERT_SELECT: no `student_email` (PII that appears on no public
 * surface anywhere), and no `is_hidden` — every row here is visible by
 * definition, so echoing the flag would only tell a stranger that hidden
 * rows exist.
 *
 * `student_name` IS selected, but never returned per-certificate: it is used
 * once, as the profile's display name fallback. See publicDisplayName.
 */
const PUBLIC_CERT_SELECT = `
  id, student_name, course_name, completion_date, expiry_date,
  claim_state, revoked_at, created_at,
  organizations ( name ),
  courses ( badge_url ),
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
    badge_url: row.courses?.badge_url ?? null,
    completion_date: row.completion_date,
    expiry_date: row.expiry_date,
    issued_at: row.created_at,
    issuedAtBlockchainTimestamp: currentHash?.chain_issued_at ?? null,
    status: issuerStatus(row, now),
    is_hidden: row.is_hidden,
  };
}

/**
 * Maps a row onto the shape the public profile page renders
 * (frontend/app/pages/p/[holderId].vue).
 *
 * Revoked and expired certificates are NOT filtered out. A public profile that
 * quietly dropped them would be a nicer showcase and a dishonest record — an
 * employer browsing it would have no way to tell absence from revocation. The
 * holder already has the precise tool for this: hide that one certificate.
 */
function toPublicShape(row, now = new Date()) {
  const currentHash =
    (row.certificate_hashes ?? []).find((h) => h.is_current) ?? null;
  return {
    id: row.id,
    course_name: row.course_name,
    institution_name: row.organizations?.name ?? null,
    badge_url: row.courses?.badge_url ?? null,
    completion_date: row.completion_date,
    expiry_date: row.expiry_date,
    issued_at: row.created_at,
    issuedAtBlockchainTimestamp: currentHash?.chain_issued_at ?? null,
    status: issuerStatus(row, now),
  };
}

/**
 * The name to show on a public profile.
 *
 * Never falls back to the email local part the way displayName() does in the
 * frontend — that helper labels a signed-in user to themselves, where showing
 * a fragment of their own address is harmless. Here the label is published to
 * anyone with the link, and "chhaylyhour425" is a piece of a private address.
 *
 * The fallback is the student_name the institution issued to, which is already
 * public on every /cert/:id page, so it discloses nothing new.
 */
function publicDisplayName(profile, certRows) {
  if (profile.full_name) return profile.full_name;
  return certRows[0]?.student_name ?? 'Certificate holder';
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

  /**
   * @openapi
   * /api/profiles/{holderId}:
   *   get:
   *     summary: A holder's public certificate profile
   *     description: >
   *       The browsable list that `is_hidden` and `profile_is_public` govern
   *       (FR-HOLD-04/05/06). Lists only certificates with `is_hidden = false`,
   *       and only when the holder's profile is public. Unlike
   *       `GET /api/certificates/verify/{certId}`, which ignores both flags on
   *       purpose (FR-HOLD-07), this endpoint is the one place they bind.
   *     tags: [Holder]
   *     security: []
   *     responses:
   *       200:
   *         description: The holder's visible certificates, most recent first.
   *       404:
   *         description: >
   *           No such profile, not a holder, deactivated, or private —
   *           deliberately indistinguishable.
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/ErrorResponse' }
   */
  router.get(
    '/profiles/:holderId',
    publicProfileLimiter,
    validateAll({ params: holderIdParamSchema }),
    async (req, res, next) => {
      try {
        const { holderId } = req.validated.params;

        const profile = unwrap(
          await adminClient
            .from('profiles')
            .select('id, full_name, role, status, profile_is_public')
            .eq('id', holderId)
            .maybeSingle(),
          'load public profile'
        );

        // ONE 404 for every reason, and the collapse is the privacy property,
        // not laziness. A distinct "this profile is private" response would
        // confirm that the account exists and has chosen to hide — which is
        // exactly the fact the setting is meant to withhold. It would also
        // turn the endpoint into an existence oracle for any id someone got
        // hold of. Non-holders and deactivated accounts fold in for the same
        // reason.
        if (
          !profile ||
          profile.role !== ROLES.HOLDER ||
          profile.status !== 'active' ||
          !profile.profile_is_public
        ) {
          throw notFound('Profile not found.');
        }

        const rows =
          unwrap(
            await adminClient
              .from('certificates')
              .select(PUBLIC_CERT_SELECT)
              .eq('holder_id', holderId)
              // The whole point of the feature. Filtered in the query rather
              // than after the fetch so a hidden row never leaves the database.
              .eq('is_hidden', false)
              .order('created_at', { ascending: false }),
            'list public profile certificates'
          ) ?? [];

        // A profile is public but may legitimately have nothing to show (every
        // certificate hidden, or none claimed yet). That is a 200 with an empty
        // list, not a 404 — the holder chose to have a page.
        res.json({
          holder: {
            id: profile.id,
            display_name: publicDisplayName(profile, rows),
          },
          certificates: rows.map((row) => toPublicShape(row)),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const holderRouter = createHolderRouter();
