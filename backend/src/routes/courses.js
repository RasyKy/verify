/**
 * Courses — backs the typeahead in CertificateForm.vue, and per-course
 * certificate template selection (the /issuer/courses page).
 *
 *   GET    /api/courses                 issuer  → ["Web Development Fundamentals", …]
 *   POST   /api/courses                 issuer  → { id, name }
 *   GET    /api/courses/full            issuer  → [{ id, name, certificateTemplate }, …]
 *   PATCH  /api/courses/:id/template    issuer  → { id, name, certificateTemplate }
 *
 * GET /courses returns a BARE STRING ARRAY, not objects. That is what the
 * UInputMenu the form uses consumes, and wrapping each name in an object
 * would mean editing the component for no gain — /courses/full is a
 * separate endpoint for the course-management page precisely so this
 * contract never has to change.
 *
 * Template choice is purely presentational metadata: certificate_template is
 * never read by services/hash.js, so changing a course's template has zero
 * effect on the certificate hash, the chain, or verification — it only
 * changes how services/certificateRender.js renders future downloads.
 */
import { Router } from 'express';

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
import {
  createCourseSchema,
  updateCourseTemplateSchema,
} from '../schemas/certificate.js';
import { uuidParam } from '../schemas/common.js';
import { notFound } from '../lib/errors.js';

const courseIdParams = uuidParam('id');

export function createCoursesRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
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
   *     description: >
   *       `certificateTemplate` is optional and only applied when the course
   *       is actually created — idempotent re-submission of an existing
   *       course name never overwrites its template.
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
      const { name, certificateTemplate } = req.validated.body;
      try {
        // Idempotent on (organization_id, name): the typeahead can fire twice on
        // a fast double-click, and a duplicate must return the existing row
        // rather than a 409 the user cannot act on. certificateTemplate is
        // deliberately ignored on this path — re-submitting a course's own
        // name must never silently overwrite a template someone already set.
        const existing = unwrap(
          await adminClient
            .from('courses')
            .select('id, name, certificate_template')
            .eq('organization_id', req.user.organizationId)
            .eq('name', name)
            .maybeSingle(),
          'find course'
        );
        if (existing) {
          return res.status(201).json({
            id: existing.id,
            name: existing.name,
            certificateTemplate: existing.certificate_template,
          });
        }

        const created = unwrap(
          await adminClient
            .from('courses')
            .insert({
              organization_id: req.user.organizationId,
              name,
              created_by: req.user.id,
              ...(certificateTemplate
                ? { certificate_template: certificateTemplate }
                : {}),
            })
            .select('id, name, certificate_template')
            .single(),
          'create course'
        );
        res.status(201).json({
          id: created.id,
          name: created.name,
          certificateTemplate: created.certificate_template,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/courses/full:
   *   get:
   *     summary: The organization's courses, with certificate template info
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array of { id, name, certificateTemplate }
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
          .select('id, name, certificate_template')
          .eq('organization_id', req.user.organizationId)
          .order('name'),
        'list courses (full)'
      );
      res.json(
        (rows ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          certificateTemplate: row.certificate_template,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/courses/{id}/template:
   *   patch:
   *     summary: Set which certificate template a course's certificates use
   *     description: >
   *       Purely presentational — has no effect on the certificate hash, the
   *       chain, or verification.
   *     tags: [Courses]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated course, with the new certificateTemplate
   *       404:
   *         description: No such course in the caller's organization
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
    '/courses/:id/template',
    ...issuerOnly,
    validateAll({ params: courseIdParams, body: updateCourseTemplateSchema }),
    async (req, res, next) => {
      try {
        const { id } = req.validated.params;
        const { certificateTemplate } = req.validated.body;

        const course = unwrap(
          await adminClient
            .from('courses')
            .select('id')
            .eq('id', id)
            .eq('organization_id', req.user.organizationId)
            .maybeSingle(),
          'load course for template update'
        );
        if (!course) throw notFound('Course not found.');

        const updated = unwrap(
          await adminClient
            .from('courses')
            .update({ certificate_template: certificateTemplate })
            .eq('id', id)
            .select('id, name, certificate_template')
            .maybeSingle(),
          'update course template'
        );
        res.json({
          id: updated.id,
          name: updated.name,
          certificateTemplate: updated.certificate_template,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const coursesRouter = createCoursesRouter();
