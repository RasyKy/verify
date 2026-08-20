/**
 * Courses — backs the typeahead in CertificateForm.vue.
 *
 *   GET  /api/courses   issuer  → ["Web Development Fundamentals", …]
 *   POST /api/courses   issuer  → { id, name }
 *
 * GET returns a BARE STRING ARRAY, not objects. That is what the UInputMenu the
 * form uses consumes, and wrapping each name in an object would mean editing the
 * component for no gain.
 */
import { Router } from 'express';

import { adminClient as defaultAdminClient, unwrap } from '../config/supabase.js';
import { requireAuth, requireOrganization, requireRole, ROLES } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCourseSchema } from '../schemas/certificate.js';

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

  return router;
}

export const coursesRouter = createCoursesRouter();
