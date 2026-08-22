/**
 * Certificate endpoints.
 *
 *   POST /api/certificates                    issue   (issuer/admin) → real chain tx
 *   GET  /api/certificates                    list    (issuer/admin, org-scoped)
 *   GET  /api/certificates/:id                detail  (issuer/admin, org-scoped)
 *   POST /api/certificates/:id/revoke         revoke  (issuer/admin) → real chain tx
 *   GET  /api/certificates/verify/:certId     PUBLIC  verification
 *
 * Built as a factory so tests inject a fake service instead of touching
 * Supabase or Amoy (jest.mock does not work under this ESM setup).
 *
 * Responses are snake_case, matching the rest of the API; the frontend maps to
 * camelCase in one composable rather than the backend guessing per-route.
 */
import { Router } from 'express';

import {
  requireAuth as defaultRequireAuth,
  requireOrganization,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../schemas/common.js';
import {
  issueCertificateSchema,
  listCertificatesSchema,
  revokeCertificateSchema,
  verifyParamsSchema,
} from '../schemas/certificate.js';
import { certificateService as defaultService } from '../services/certificateService.js';

/**
 * @param {object} [deps]
 * @param {ReturnType<import('../services/certificateService.js').createCertificateService>} [deps.service]
 * @param {import('express').RequestHandler} [deps.requireAuth]
 */
export function createCertificateRouter({
  service = defaultService,
  requireAuth = defaultRequireAuth,
} = {}) {
  const router = Router();

  /**
   * Issuing requires an institution to attribute the certificate to, and
   * `certificates.organization_id` is NOT NULL. A platform admin deliberately
   * belongs to no institution, so an admin cannot issue — there is no correct
   * organization to record.
   */
  const canIssue = [
    requireAuth,
    requireRole(ROLES.ISSUER),
    requireOrganization,
  ];

  /**
   * Reading and revoking are open to admins platform-wide. The service scopes
   * an issuer to its own organization and lets an admin through (see the
   * `role !== 'admin'` checks in certificateService.js), so the org filter is
   * applied there rather than in a middleware that cannot express "all".
   *
   * `requireOrganization` still applies to issuers: one with no institution
   * would otherwise query `organization_id = null` and see nothing, which
   * looks like data loss rather than a misconfigured account.
   */
  const requireScope = (req, res, next) =>
    req.user?.role === ROLES.ADMIN
      ? next()
      : requireOrganization(req, res, next);

  const canManage = [
    requireAuth,
    requireRole(ROLES.ISSUER, ROLES.ADMIN),
    requireScope,
  ];

  /**
   * @openapi
   * /api/certificates/verify/{certId}:
   *   get:
   *     summary: Publicly verify a certificate against the blockchain
   *     tags: [Certificates]
   *     security: []
   */
  // Mounted BEFORE '/:id' — Express matches in order, and '/verify/x' would
  // otherwise be captured by the '/:id' route and rejected as a bad UUID.
  //
  // Validation is inline rather than via the `validate` middleware because a
  // malformed ID must render as "invalid", not as a 422. The public page lets
  // a verifier paste anything into the search box, and an error response there
  // surfaces as a broken page rather than an answer. (`validate` calls
  // next(err), which jumps straight to the error handler — a second fallback
  // route would never be reached.)
  router.get('/verify/:certId', async (req, res, next) => {
    const parsed = verifyParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.json({ status: 'invalid', certificate: null });
    }
    try {
      res.json(await service.verifyByCertId(parsed.data.certId, req));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/certificates:
   *   post:
   *     summary: Issue a certificate and anchor its hash on chain
   *     tags: [Certificates]
   */
  router.post(
    '/',
    ...canIssue,
    validate(issueCertificateSchema),
    async (req, res, next) => {
      try {
        const created = await service.issue(req.validated.body, req.user);
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates:
   *   get:
   *     summary: List certificates for the caller's institution
   *     tags: [Certificates]
   */
  router.get(
    '/',
    ...canManage,
    validate(listCertificatesSchema, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.list(req.user, req.validated.query));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}:
   *   get:
   *     summary: Certificate detail
   *     tags: [Certificates]
   */
  router.get(
    '/:id',
    ...canManage,
    validate(uuidParam('id'), 'params'),
    async (req, res, next) => {
      try {
        res.json(await service.getById(req.validated.params.id, req.user));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}/revoke:
   *   post:
   *     summary: Revoke a certificate on chain and in the database
   *     tags: [Certificates]
   */
  router.post(
    '/:id/revoke',
    ...canManage,
    validate(uuidParam('id'), 'params'),
    validate(revokeCertificateSchema),
    async (req, res, next) => {
      try {
        res.json(
          await service.revoke(
            req.validated.params.id,
            req.user,
            req.validated.body.reason
          )
        );
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const certificatesRouter = createCertificateRouter();
