/**
 * Certificate endpoints — the core product surface.
 *
 *   GET  /api/certificates              issuer  list, org-scoped, snake_case
 *   POST /api/certificates              issuer  issue (FR-ISSUE-01..07)
 *   GET  /api/certificates/verify/:id   PUBLIC  verification (FR-VERIFY-01..05)
 *   GET  /api/certificates/:id          issuer  single, org-scoped
 *   PUT  /api/certificates/:id          issuer  edit = revoke + reissue
 *   POST /api/certificates/:id/revoke   issuer  revoke (FR-MGMT-03)
 *   POST /api/certificates/:id/resend-claim
 *                                      issuer+admin  reissue the claim link
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
import { certificateRenderService as defaultRenderService } from '../services/certificateRender.js';
import { logger } from '../lib/logger.js';
import {
  requireAuth,
  requireOrganization,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import {
  downloadLimiter,
  issuanceLimiter,
  verifyLimiter,
} from '../middleware/rateLimit.js';
import { validate, validateAll } from '../middleware/validate.js';
import {
  certIdParamSchema,
  downloadQuerySchema,
  issueCertificateSchema,
  listCertificatesSchema,
  qrQuerySchema,
  revokeCertificateSchema,
  updateCertificateSchema,
} from '../schemas/certificate.js';
import { notFound } from '../lib/errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * organizations.logo_url / signature_url can be a root-relative path (seed
 * data and any asset served from the frontend's own /public folder, e.g.
 * "/rupp-logo.png") rather than an absolute Supabase Storage URL. The
 * Puppeteer render has no origin of its own — page.setContent() carries no
 * base URL — so a relative src silently fails to load there even though it
 * resolves fine everywhere in-app (the browser fills in the frontend's own
 * origin). Resolve against publicAppUrl so both forms render correctly;
 * already-absolute URLs (real uploads) pass through unchanged.
 */
function resolveAssetUrl(url) {
  if (!url) return url;
  try {
    return new URL(url, env.publicAppUrl).href;
  } catch {
    return url;
  }
}

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
  renderService = defaultRenderService,
  requireAuth: auth = requireAuth,
} = {}) {
  const router = Router();
  const issuerOnly = [auth, requireRole(ROLES.ISSUER), requireOrganization];

  /*
   * Issuer OR admin. `requireOrganization` cannot sit in this chain because an
   * admin belongs to no institution by design — but dropping it outright would
   * let an ISSUER with no institution through, and the service reads a missing
   * organizationId as "not scoped to one org", i.e. the whole platform. So the
   * guard is kept for everyone except the role that is meant to be unscoped.
   */
  const issuerOrAdmin = [
    auth,
    requireRole(ROLES.ISSUER, ROLES.ADMIN),
    function requireOrganizationUnlessAdmin(req, res, next) {
      if (req.user?.role === ROLES.ADMIN) return next();
      return requireOrganization(req, res, next);
    },
  ];

  /**
   * @openapi
   * /api/certificates/verify/{certId}:
   *   get:
   *     summary: Publicly verify a certificate
   *     tags: [Verification]
   *     security: []
   *     parameters:
   *       - name: certId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Any string is accepted — a malformed UUID answers `invalid`, not a 4xx.
   *     responses:
   *       200:
   *         description: Verification result — status is verified, invalid, revoked or expired
   *       429:
   *         description: Rate limited
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: The chain or database is temporarily unreachable — not a verdict on the certificate
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - name: format
   *         in: query
   *         schema:
   *           type: string
   *           enum: [png, svg]
   *           default: png
   *       - name: size
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 64
   *           maximum: 1024
   *           default: 320
   *     responses:
   *       200:
   *         description: QR code image
   *         content:
   *           image/png: {}
   *           image/svg+xml: {}
   *       422:
   *         description: Validation failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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
   * /api/certificates/{id}/download:
   *   get:
   *     summary: Rendered certificate document (PDF or PNG)
   *     description: >
   *       Server-rendered from the same publicly-verifiable record
   *       /cert/{certId} and /verify/{certId} already show — a revoked or
   *       expired certificate's download reflects the same status a viewer
   *       would see on-screen. Institution branding (logo, signature,
   *       signatory, template) is purely presentational and has no bearing
   *       on the hash or the chain.
   *     tags: [Certificates]
   *     security: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - name: format
   *         in: query
   *         schema:
   *           type: string
   *           enum: [pdf, png]
   *           default: pdf
   *     responses:
   *       200:
   *         description: The rendered document
   *         content:
   *           application/pdf: {}
   *           image/png: {}
   *       404:
   *         description: No such certificate, or its status could not be verified
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
   *       429:
   *         description: Rate limited
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: The chain, database, or renderer is temporarily unreachable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(
    '/certificates/:id/download',
    downloadLimiter,
    validateAll({ params: certIdParamSchema, query: downloadQuerySchema }),
    async (req, res, next) => {
      const { id } = req.validated.params;
      const { format } = req.validated.query;

      try {
        const result = await service.verify({ certId: id });
        if (!result.certificate) {
          throw notFound('Certificate not found.');
        }

        const renderData = {
          status: result.status,
          studentName: result.certificate.studentName,
          courseName: result.certificate.courseName,
          institutionName: result.certificate.institutionName,
          completionDate: result.certificate.completionDate,
          certId: result.certificate.certId,
          verifyUrl: `${env.publicAppUrl}/cert/${id}`,
          logoUrl: resolveAssetUrl(result.certificate.logoUrl),
          signatureUrl: resolveAssetUrl(result.certificate.signatureUrl),
          signatoryName: result.certificate.signatoryName,
          signatoryTitle: result.certificate.signatoryTitle,
          certificateTemplate: result.certificate.certificateTemplate,
        };

        const fileBase = `certificate-${id}`;
        if (format === 'png') {
          const png = await renderService.renderPng(renderData);
          res.type('image/png');
          res.set(
            'Content-Disposition',
            `attachment; filename="${fileBase}.png"`
          );
          return res.send(png);
        }

        const pdf = await renderService.renderPdf(renderData);
        res.type('application/pdf');
        res.set(
          'Content-Disposition',
          `attachment; filename="${fileBase}.pdf"`
        );
        return res.send(pdf);
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
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of certificates
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an issuer, or has no organization
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
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Certificate issued
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an issuer, or has no organization
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
   *       429:
   *         description: Rate limited
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       503:
   *         description: The chain is temporarily unreachable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: The certificate
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an issuer, or has no organization
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Certificate not found
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
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Certificate updated (revoked + reissued)
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an issuer, or has no organization
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Certificate not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Certificate has already been revoked
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
   *       503:
   *         description: The chain is temporarily unreachable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Certificate revoked
   *       401:
   *         description: Missing or invalid bearer token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Caller is not an issuer, or has no organization
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Certificate not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Certificate has already been revoked
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
   *       503:
   *         description: The chain is temporarily unreachable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
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

  /**
   * @openapi
   * /api/certificates/{id}/resend-claim:
   *   post:
   *     summary: Mint a fresh claim link and email it again
   *     description: >
   *       Retires the outstanding claim token and issues a replacement, valid
   *       for another 7 days. Outside production the response also carries the
   *       live `claim_url`, so the flow can be exercised when mail cannot be
   *       delivered.
   *     tags: [Certificates]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: A new claim link was minted; `claim_email_sent` says whether the mail went out
   *       403:
   *         description: Caller is neither an admin nor an issuer at the owning institution
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: No such certificate
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Already claimed, or revoked — neither has a link worth sending
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/certificates/:id/resend-claim',
    ...issuerOrAdmin,
    validate(certIdParamSchema, 'params'),
    async (req, res, next) => {
      try {
        res.json(
          await service.resendClaim({
            id: req.validated.params.id,
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
