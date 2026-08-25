/**
 * Courses — backs the typeahead in CertificateForm.vue, and course-level
 * badge management (the /issuer/courses page).
 *
 *   GET    /api/courses            issuer  → ["Web Development Fundamentals", …]
 *   POST   /api/courses            issuer  → { id, name }
 *   GET    /api/courses/full       issuer  → [{ id, name, badgeUrl }, …]
 *   POST   /api/courses/:id/badge  issuer  → { id, name, badgeUrl }
 *   DELETE /api/courses/:id/badge  issuer  → { id, name, badgeUrl: null }
 *
 * GET /courses returns a BARE STRING ARRAY, not objects. That is what the
 * UInputMenu the form uses consumes, and wrapping each name in an object
 * would mean editing the component for no gain — /courses/full is a
 * separate endpoint for the badge-management page precisely so this
 * contract never has to change.
 *
 * Badge images are purely presentational metadata (frontend-design plan,
 * per-course-badges branch): badge_url is never read by services/hash.js,
 * so uploading/replacing/removing one has zero effect on the certificate
 * hash, the chain, or verification.
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
import { validate, validateAll } from '../middleware/validate.js';
import { createCourseSchema } from '../schemas/certificate.js';
import { uuidParam } from '../schemas/common.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  deleteBadge as defaultDeleteBadge,
  uploadBadge as defaultUploadBadge,
} from '../services/storage.js';

const MAX_BADGE_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BADGE_BYTES },
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

const courseIdParams = uuidParam('id');

export function createCoursesRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
  uploadBadge = defaultUploadBadge,
  deleteBadge = defaultDeleteBadge,
} = {}) {
  const router = Router();
  const issuerOnly = [auth, requireRole(ROLES.ISSUER), requireOrganization];

  /**
   * @openapi
   * /api/courses:
   *   get:
   *     summary: The organization's course names
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array of course names
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
  router.get('/courses', ...issuerOnly, async (req, res, next) => {
    try {
      const rows = unwrap(
        await adminClient
          .from('courses')
          .select('name')
          .eq('organization_id', req.user.organizationId)
          .order('name'),
        'list courses'
      );
      res.json((rows ?? []).map((row) => row.name));
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/courses:
   *   post:
   *     summary: Add a course to the organization's list
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Course created, or the existing course with that name
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
  router.post(
    '/courses',
    ...issuerOnly,
    validate(createCourseSchema),
    async (req, res, next) => {
      const { name } = req.validated.body;
      try {
        // Idempotent on (organization_id, name): the typeahead can fire twice on
        // a fast double-click, and a duplicate must return the existing row
        // rather than a 409 the user cannot act on.
        const existing = unwrap(
          await adminClient
            .from('courses')
            .select('id, name')
            .eq('organization_id', req.user.organizationId)
            .eq('name', name)
            .maybeSingle(),
          'find course'
        );
        if (existing) return res.status(201).json(existing);

        const created = unwrap(
          await adminClient
            .from('courses')
            .insert({
              organization_id: req.user.organizationId,
              name,
              created_by: req.user.id,
            })
            .select('id, name')
            .single(),
          'create course'
        );
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/courses/full:
   *   get:
   *     summary: The organization's courses, with badge info (for /issuer/courses)
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array of { id, name, badgeUrl }
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
  router.get('/courses/full', ...issuerOnly, async (req, res, next) => {
    try {
      const rows = unwrap(
        await adminClient
          .from('courses')
          .select('id, name, badge_url')
          .eq('organization_id', req.user.organizationId)
          .order('name'),
        'list courses (full)'
      );
      res.json(
        (rows ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          badgeUrl: row.badge_url,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/courses/{id}/badge:
   *   post:
   *     summary: Upload (or replace) a course's badge image
   *     description: >
   *       multipart/form-data, field name "badge". PNG or JPG only, 2MB max —
   *       purely presentational, has no effect on the certificate hash or
   *       verification.
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated course, with the new badgeUrl
   *       400:
   *         description: Missing file, wrong type, or too large
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: No such course in the caller's organization
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/courses/:id/badge',
    ...issuerOnly,
    validateAll({ params: courseIdParams }),
    (req, res, next) => {
      upload.single('badge')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            badRequest(
              `Badge image must be ${MAX_BADGE_BYTES / (1024 * 1024)}MB or smaller.`
            )
          );
        }
        next(badRequest('Could not read the uploaded file.'));
      });
    },
    async (req, res, next) => {
      try {
        const { id } = req.validated.params;
        if (!req.file) throw badRequest('No badge image was uploaded.');

        const ext = detectImageExt(req.file.buffer, req.file.mimetype);
        if (!ext) throw badRequest('Badge image must be a PNG or JPG file.');

        const course = unwrap(
          await adminClient
            .from('courses')
            .select('id')
            .eq('id', id)
            .eq('organization_id', req.user.organizationId)
            .maybeSingle(),
          'load course for badge upload'
        );
        if (!course) throw notFound('Course not found.');

        const badgeUrl = await uploadBadge(
          req.user.organizationId,
          id,
          req.file.buffer,
          ext,
          req.file.mimetype
        );

        const updated = unwrap(
          await adminClient
            .from('courses')
            .update({ badge_url: badgeUrl })
            .eq('id', id)
            .select('id, name, badge_url')
            .maybeSingle(),
          'save course badge'
        );
        res.json({
          id: updated.id,
          name: updated.name,
          badgeUrl: updated.badge_url,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/courses/{id}/badge:
   *   delete:
   *     summary: Remove a course's badge image
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated course, with badgeUrl now null
   *       404:
   *         description: No such course in the caller's organization
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.delete(
    '/courses/:id/badge',
    ...issuerOnly,
    validateAll({ params: courseIdParams }),
    async (req, res, next) => {
      try {
        const { id } = req.validated.params;

        const course = unwrap(
          await adminClient
            .from('courses')
            .select('id')
            .eq('id', id)
            .eq('organization_id', req.user.organizationId)
            .maybeSingle(),
          'load course for badge removal'
        );
        if (!course) throw notFound('Course not found.');

        await deleteBadge(req.user.organizationId, id);

        const updated = unwrap(
          await adminClient
            .from('courses')
            .update({ badge_url: null })
            .eq('id', id)
            .select('id, name, badge_url')
            .maybeSingle(),
          'clear course badge'
        );
        res.json({
          id: updated.id,
          name: updated.name,
          badgeUrl: updated.badge_url,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const coursesRouter = createCoursesRouter();
