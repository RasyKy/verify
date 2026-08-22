/**
 * Platform administration endpoints.
 *
 *   POST   /api/admin/users                    invite an issuer or admin
 *   GET    /api/admin/users                    list accounts
 *   PATCH  /api/admin/users/:id                deactivate / reactivate
 *   POST   /api/admin/organizations            create an institution
 *   GET    /api/admin/organizations            list institutions
 *   PATCH  /api/admin/organizations/:id        suspend / reactivate
 *
 * Every route here is admin-only. The guard is applied once to the whole
 * router rather than per-route: a new endpoint added below is protected by
 * default, which is the failure mode you want when someone is in a hurry.
 *
 * Note there is no `requireOrganization` — a platform admin deliberately
 * belongs to no institution (see the check constraint in 0001_init.sql).
 */
import { Router } from 'express';

import {
  requireAuth as defaultRequireAuth,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uuidParam } from '../schemas/common.js';
import {
  createOrganizationSchema,
  inviteUserSchema,
  listOrganizationsSchema,
  listUsersSchema,
  updateOrganizationStatusSchema,
  updateUserStatusSchema,
} from '../schemas/admin.js';
import { adminService as defaultService } from '../services/adminService.js';

/**
 * @param {object} [deps]
 * @param {ReturnType<import('../services/adminService.js').createAdminService>} [deps.service]
 * @param {import('express').RequestHandler} [deps.requireAuth]
 */
export function createAdminRouter({
  service = defaultService,
  requireAuth = defaultRequireAuth,
} = {}) {
  const router = Router();

  // Applies to every route defined after it, including any added later.
  router.use(requireAuth, requireRole(ROLES.ADMIN));

  // ── Users ─────────────────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/users:
   *   post:
   *     summary: Invite an issuer or admin by email
   *     tags: [Admin]
   */
  router.post('/users', validate(inviteUserSchema), async (req, res, next) => {
    try {
      const profile = await service.inviteUser(req.validated.body, req.user);
      res.status(201).json(profile);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/admin/users:
   *   get:
   *     summary: List accounts
   *     tags: [Admin]
   */
  router.get(
    '/users',
    validate(listUsersSchema, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.listUsers(req.validated.query));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/users/{id}:
   *   patch:
   *     summary: Deactivate or reactivate an account
   *     tags: [Admin]
   */
  router.patch(
    '/users/:id',
    validate(uuidParam('id'), 'params'),
    validate(updateUserStatusSchema),
    async (req, res, next) => {
      try {
        res.json(
          await service.setUserStatus(
            req.validated.params.id,
            req.validated.body.status,
            req.user
          )
        );
      } catch (err) {
        next(err);
      }
    }
  );

  // ── Organizations ─────────────────────────────────────────────────────────

  /**
   * @openapi
   * /api/admin/organizations:
   *   post:
   *     summary: Create an institution
   *     tags: [Admin]
   */
  router.post(
    '/organizations',
    validate(createOrganizationSchema),
    async (req, res, next) => {
      try {
        const org = await service.createOrganization(
          req.validated.body,
          req.user
        );
        res.status(201).json(org);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/organizations:
   *   get:
   *     summary: List institutions
   *     tags: [Admin]
   */
  router.get(
    '/organizations',
    validate(listOrganizationsSchema, 'query'),
    async (req, res, next) => {
      try {
        res.json(await service.listOrganizations(req.validated.query));
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * @openapi
   * /api/admin/organizations/{id}:
   *   patch:
   *     summary: Suspend or reactivate an institution
   *     tags: [Admin]
   */
  router.patch(
    '/organizations/:id',
    validate(uuidParam('id'), 'params'),
    validate(updateOrganizationStatusSchema),
    async (req, res, next) => {
      try {
        res.json(
          await service.setOrganizationStatus(
            req.validated.params.id,
            req.validated.body.status,
            req.user
          )
        );
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const adminRouter = createAdminRouter();
