/**
 * Issuer self-service organization settings — certificate branding.
 *
 *   GET    /api/organizations/me            issuer → org record + branding
 *   PATCH  /api/organizations/me            issuer → signatory name/title
 *   POST   /api/organizations/me/logo        issuer → { logoUrl }
 *   DELETE /api/organizations/me/logo        issuer → { logoUrl: null }
 *   POST   /api/organizations/me/signature   issuer → { signatureUrl }
 *   DELETE /api/organizations/me/signature   issuer → { signatureUrl: null }
 *
 * All fields here are purely presentational — read only by
 * services/certificateRender.js, never by services/hash.js. See
 * db/migrations/0006_certificate_branding.sql.
 */
import { Router } from 'express';
import multer from 'multer';

import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import {
  requireAuth,
  requireOrganization,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateOrganizationSchema } from '../schemas/organizations.js';
import { badRequest } from '../lib/errors.js';
import {
  deleteLogo as defaultDeleteLogo,
  deleteSignature as defaultDeleteSignature,
  uploadLogo as defaultUploadLogo,
  uploadSignature as defaultUploadSignature,
} from '../services/organizationAssets.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function isJpeg(buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

/**
 * The file's declared mimetype is client-supplied and trivially spoofable,
 * so it is only ever used alongside a magic-byte check on the actual bytes
 * — never on its own.
 * @returns {'png' | 'jpg' | null}
 */
function detectImageExt(buffer, mimetype) {
  if (mimetype === 'image/png' && isPng(buffer)) return 'png';
  if (
    (mimetype === 'image/jpeg' || mimetype === 'image/jpg') &&
    isJpeg(buffer)
  ) {
    return 'jpg';
  }
  return null;
}

const ORG_SELECT =
  'id, name, logo_url, signature_url, signatory_name, signatory_title';

function toOrgShape(row) {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    signatureUrl: row.signature_url,
    signatoryName: row.signatory_name,
    signatoryTitle: row.signatory_title,
  };
}

function uploadMiddleware(fieldName) {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          badRequest(
            `Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`
          )
        );
      }
      next(badRequest('Could not read the uploaded file.'));
    });
  };
}

export function createOrganizationsRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
  uploadLogo = defaultUploadLogo,
  deleteLogo = defaultDeleteLogo,
  uploadSignature = defaultUploadSignature,
  deleteSignature = defaultDeleteSignature,
} = {}) {
  const router = Router();
  const issuerOnly = [auth, requireRole(ROLES.ISSUER), requireOrganization];

  /**
   * @openapi
   * /api/organizations/me:
   *   get:
   *     summary: The caller's own organization, with certificate branding
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: The organization record
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
   */
  router.get('/organizations/me', ...issuerOnly, async (req, res, next) => {
    try {
      const row = unwrap(
        await adminClient
          .from('organizations')
          .select(ORG_SELECT)
          .eq('id', req.user.organizationId)
          .maybeSingle(),
        'load organization'
      );
      res.json(toOrgShape(row));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/organizations/me:
   *   patch:
   *     summary: Update the caller's organization's certificate branding
   *     description: >
   *       Signatory name/title are purely presentational — never read by
   *       services/hash.js. Template choice is per-course, not here — see
   *       PATCH /api/courses/{id}/template.
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated organization record
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
  router.patch(
    '/organizations/me',
    ...issuerOnly,
    validate(updateOrganizationSchema),
    async (req, res, next) => {
      try {
        const { signatoryName, signatoryTitle } = req.validated.body;
        const patch = {};
        if (signatoryName !== undefined) patch.signatory_name = signatoryName;
        if (signatoryTitle !== undefined)
          patch.signatory_title = signatoryTitle;

        const updated = unwrap(
          await adminClient
            .from('organizations')
            .update(patch)
            .eq('id', req.user.organizationId)
            .select(ORG_SELECT)
            .maybeSingle(),
          'update organization branding'
        );
        res.json(toOrgShape(updated));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/organizations/me/logo:
   *   post:
   *     summary: Upload (or replace) the organization's logo
   *     description: multipart/form-data, field name "logo". PNG or JPG only, 2MB max.
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated organization, with the new logoUrl
   *       400:
   *         description: Missing file, wrong type, or too large
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/organizations/me/logo',
    ...issuerOnly,
    uploadMiddleware('logo'),
    async (req, res, next) => {
      try {
        if (!req.file) throw badRequest('No logo image was uploaded.');
        const ext = detectImageExt(req.file.buffer, req.file.mimetype);
        if (!ext) throw badRequest('Logo image must be a PNG or JPG file.');

        const logoUrl = await uploadLogo(
          req.user.organizationId,
          req.file.buffer,
          ext,
          req.file.mimetype
        );

        const updated = unwrap(
          await adminClient
            .from('organizations')
            .update({ logo_url: logoUrl })
            .eq('id', req.user.organizationId)
            .select(ORG_SELECT)
            .maybeSingle(),
          'save organization logo'
        );
        res.json(toOrgShape(updated));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/organizations/me/logo:
   *   delete:
   *     summary: Remove the organization's logo
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated organization, with logoUrl now null
   */
  router.delete(
    '/organizations/me/logo',
    ...issuerOnly,
    async (req, res, next) => {
      try {
        await deleteLogo(req.user.organizationId);
        const updated = unwrap(
          await adminClient
            .from('organizations')
            .update({ logo_url: null })
            .eq('id', req.user.organizationId)
            .select(ORG_SELECT)
            .maybeSingle(),
          'clear organization logo'
        );
        res.json(toOrgShape(updated));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/organizations/me/signature:
   *   post:
   *     summary: Upload (or replace) the organization's signatory signature image
   *     description: multipart/form-data, field name "signature". PNG or JPG only, 2MB max.
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated organization, with the new signatureUrl
   *       400:
   *         description: Missing file, wrong type, or too large
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/organizations/me/signature',
    ...issuerOnly,
    uploadMiddleware('signature'),
    async (req, res, next) => {
      try {
        if (!req.file) throw badRequest('No signature image was uploaded.');
        const ext = detectImageExt(req.file.buffer, req.file.mimetype);
        if (!ext)
          throw badRequest('Signature image must be a PNG or JPG file.');

        const signatureUrl = await uploadSignature(
          req.user.organizationId,
          req.file.buffer,
          ext,
          req.file.mimetype
        );

        const updated = unwrap(
          await adminClient
            .from('organizations')
            .update({ signature_url: signatureUrl })
            .eq('id', req.user.organizationId)
            .select(ORG_SELECT)
            .maybeSingle(),
          'save organization signature'
        );
        res.json(toOrgShape(updated));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/organizations/me/signature:
   *   delete:
   *     summary: Remove the organization's signature image
   *     tags: [Organizations]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated organization, with signatureUrl now null
   */
  router.delete(
    '/organizations/me/signature',
    ...issuerOnly,
    async (req, res, next) => {
      try {
        await deleteSignature(req.user.organizationId);
        const updated = unwrap(
          await adminClient
            .from('organizations')
            .update({ signature_url: null })
            .eq('id', req.user.organizationId)
            .select(ORG_SELECT)
            .maybeSingle(),
          'clear organization signature'
        );
        res.json(toOrgShape(updated));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const organizationsRouter = createOrganizationsRouter();
