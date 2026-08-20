/**
 * Certificate endpoints — the core product surface.
 *
 *   GET  /api/certificates              issuer  list, org-scoped, snake_case
 *   POST /api/certificates              issuer  issue (FR-ISSUE-01..07)
 *   GET  /api/certificates/verify/:id   PUBLIC  verification (FR-VERIFY-01..05)
 *   GET  /api/certificates/:id          issuer  single, org-scoped
 *   PUT  /api/certificates/:id          issuer  edit = revoke + reissue
 *   POST /api/certificates/:id/revoke   issuer  revoke (FR-MGMT-03)
 *   GET  /api/certificates/:id/qr       PUBLIC  QR PNG/SVG (FR-HOLD-02)
 *
 * Route ORDER matters: `/verify/:certId` and the literal-prefixed routes are
 * registered before `/:id`, or Express would match "verify" as an id.
 *
 * Built as a factory so tests inject fakes — jest.mock() does not work under
 * this project's native-ESM Jest (see backend/README.md).
 */
import crypto from 'node:crypto';

import { Router } from 'express';
import QRCode from 'qrcode';

import { env } from '../config/env.js';
import { certificateService as defaultService } from '../services/certificate.js';
import { logger } from '../lib/logger.js';
import {
  requireAuth,
  requireOrganization,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { issuanceLimiter, verifyLimiter } from '../middleware/rateLimit.js';
import { validate, validateAll } from '../middleware/validate.js';
import {
  certIdParamSchema,
  issueCertificateSchema,
  listCertificatesSchema,
  qrQuerySchema,
  revokeCertificateSchema,
  updateCertificateSchema,
} from '../schemas/certificate.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client IPs are personal data under most readings, and the only thing the
 * verification log needs them for is "was this the same visitor". A salted
 * digest answers that without storing the address (NFR-SEC-02).
 */
function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(`${ip}:${env.SUPABASE_SERVICE_KEY.slice(0, 16)}`)
    .digest('hex');
}

export function createCertificatesRouter({
  service = defaultService,
  requireAuth: auth = requireAuth,
} = {}) {
  const router = Router();
  const issuerOnly = [auth, requireRole(ROLES.ISSUER), requireOrganization];

  /**
   * @openapi
   * /api/certificates/verify/{certId}:
   *   get:
   *     summary: Publicly verify a certificate
   *     tags: [Verification]
   *     security: []
   */
  router.get(
    '/certificates/verify/:certId',
    verifyLimiter,
    async (req, res, next) => {
      const { certId } = req.params;

      // The verify page's search box accepts free text, so a malformed ID is a
      // normal user action, not a client error: answer `invalid` rather than 422.
      // This also rejects enumeration attempts before they reach the database.
      if (!UUID_RE.test(certId)) {
        await service.logVerification({
          certId,
          result: 'not_found',
          ipHash: hashIp(req.ip),
          userAgent: req.get('user-agent'),
        });
        return res.json({ status: 'invalid', certificate: null });
      }

      try {
        const result = await service.verify({ certId });
        await service.logVerification({
          certId,
          result: result.status === 'invalid' ? 'invalid' : result.status,
          ipHash: hashIp(req.ip),
          userAgent: req.get('user-agent'),
        });
        res.json(result);
      } catch (err) {
        // A 503 from the chain reaches the client as UPSTREAM_UNAVAILABLE, which
        // the frontend must show as "could not check", never as "not genuine".
        await service.logVerification({
          certId,
          result: 'error',
          ipHash: hashIp(req.ip),
          userAgent: req.get('user-agent'),
        });
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}/qr:
   *   get:
   *     summary: QR code encoding the public verify URL
   *     tags: [Certificates]
   *     security: []
   */
  router.get(
    '/certificates/:id/qr',
    validateAll({ params: certIdParamSchema, query: qrQuerySchema }),
    async (req, res, next) => {
      const { id } = req.validated.params;
      const { format, size } = req.validated.query;

      // Public on purpose: a QR code is meant to be embedded in a shared
      // certificate page, and it encodes a URL that is itself public. It
      // reveals nothing that scanning the printed certificate would not.
      const payload = `${env.publicAppUrl}/verify/${id}`;

      try {
        if (format === 'svg') {
          const svg = await QRCode.toString(payload, {
            type: 'svg',
            width: size,
            margin: 1,
          });
          res.type('image/svg+xml');
          res.set('Cache-Control', 'public, max-age=86400');
          return res.send(svg);
        }

        const png = await QRCode.toBuffer(payload, {
          type: 'png',
          width: size,
          margin: 1,
        });
        res.type('image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(png);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates:
   *   get:
   *     summary: List the caller's organization's certificates
   *     tags: [Certificates]
   */
  router.get(
    '/certificates',
    ...issuerOnly,
    validate(listCertificatesSchema, 'query'),
    async (req, res, next) => {
      try {
        const { status, search, limit, offset } = req.validated.query;
        res.json(
          await service.list({
            organizationId: req.user.organizationId,
            status,
            search,
            limit,
            offset,
          })
        );
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates:
   *   post:
   *     summary: Issue a certificate
   *     tags: [Certificates]
   */
  router.post(
    '/certificates',
    ...issuerOnly,
    issuanceLimiter,
    validate(issueCertificateSchema),
    async (req, res, next) => {
      try {
        const result = await service.issue({
          input: req.validated.body,
          user: req.user,
        });
        logger.info('certificate issued', {
          certificateId: result.id,
          organizationId: req.user.organizationId,
          chainStatus: result.chain_status,
        });
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}:
   *   get:
   *     summary: One certificate, scoped to the caller's organization
   *     tags: [Certificates]
   */
  router.get(
    '/certificates/:id',
    ...issuerOnly,
    validate(certIdParamSchema, 'params'),
    async (req, res, next) => {
      try {
        res.json(
          await service.getById({
            id: req.validated.params.id,
            organizationId: req.user.organizationId,
          })
        );
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}:
   *   put:
   *     summary: Edit a certificate (revoke the old hash, issue a new one)
   *     tags: [Certificates]
   */
  router.put(
    '/certificates/:id',
    ...issuerOnly,
    validateAll({ params: certIdParamSchema, body: updateCertificateSchema }),
    async (req, res, next) => {
      try {
        res.json(
          await service.update({
            id: req.validated.params.id,
            input: req.validated.body,
            user: req.user,
          })
        );
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/certificates/{id}/revoke:
   *   post:
   *     summary: Revoke a certificate
   *     tags: [Certificates]
   */
  router.post(
    '/certificates/:id/revoke',
    ...issuerOnly,
    validateAll({ params: certIdParamSchema, body: revokeCertificateSchema }),
    async (req, res, next) => {
      try {
        res.json(
          await service.revoke({
            id: req.validated.params.id,
            reason: req.validated.body.reason ?? null,
            user: req.user,
          })
        );
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const certificatesRouter = createCertificatesRouter();
