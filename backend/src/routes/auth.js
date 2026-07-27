/**
 * Auth endpoints.
 *
 * ── Where the auth pieces actually live (the answer to "login/logout/JWT/
 *    access token/refresh token") ──
 *
 * The Nuxt app signs in directly against Supabase Auth (frontend/app/pages/
 * login.vue) and supabase-js handles token storage, refresh and logout in the
 * browser. That is the primary path and it is not going away.
 *
 * These backend endpoints are a SECOND, equivalent path over the same Supabase
 * Auth — useful for non-browser clients, for Postman testing (login here to get
 * a real access token, then call any protected route), and because the project
 * brief lists them as backend responsibilities. Both paths mint the same kind
 * of Supabase JWT and are verified by the same middleware (middleware/auth.js).
 * The backend still never invents its own tokens — it delegates to Supabase.
 *
 *   POST /api/auth/login          email + password  → { user, accessToken, refreshToken, expiresAt }
 *   POST /api/auth/refresh        refreshToken      → { accessToken, refreshToken, expiresAt }
 *   POST /api/auth/logout         (Bearer)          → revokes the session
 *   GET  /api/auth/me             (Bearer)          → profile + role + organization
 *   GET  /api/auth/account-exists ?email=           → { exists }   (claim UI branch)
 *
 * Built as a factory so tests inject a fake Supabase client instead of hitting
 * the network (jest.mock does not work under ESM).
 */
import { Router } from 'express';

import {
  getAuthClient,
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import { unauthorized } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  refreshSchema,
  accountExistsSchema,
} from '../schemas/auth.js';

/**
 * @param {object} [deps]
 * @param {() => import('@supabase/supabase-js').SupabaseClient} [deps.getAuthClient]
 * @param {import('@supabase/supabase-js').SupabaseClient} [deps.adminClient]
 * @param {import('express').RequestHandler} [deps.requireAuth]
 */
export function createAuthRouter({
  getAuthClient: getAuth = getAuthClient,
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
} = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     summary: Sign in with email and password
   *     tags: [Auth]
   *     security: []
   */
  router.post('/login', validate(loginSchema), async (req, res, next) => {
    const { email, password } = req.validated.body;
    try {
      const { data, error } = await getAuth().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Uniform message regardless of whether the email exists — do not let
        // the endpoint double as an account enumerator.
        logger.warn('login failed', { reason: error.message });
        return next(unauthorized('Invalid email or password.'));
      }
      res.json({
        user: { id: data.user.id, email: data.user.email },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/auth/refresh:
   *   post:
   *     summary: Exchange a refresh token for a fresh session
   *     tags: [Auth]
   *     security: []
   */
  router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    const { refreshToken } = req.validated.body;
    try {
      const { data, error } = await getAuth().auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error || !data.session) {
        return next(unauthorized('Invalid or expired refresh token.'));
      }
      res.json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/auth/logout:
   *   post:
   *     summary: Revoke the caller's session
   *     tags: [Auth]
   */
  router.post('/logout', auth, async (req, res, next) => {
    try {
      // Service-role admin sign-out revokes the user's refresh tokens server
      // side, so a stolen refresh token cannot be replayed after logout.
      // Best-effort: a failure here should not stop the client logging out.
      if (req.token && adminClient.auth?.admin?.signOut) {
        await adminClient.auth.admin
          .signOut(req.token)
          .catch((e) =>
            logger.warn('admin signOut failed', { reason: e?.message })
          );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/auth/me:
   *   get:
   *     summary: Current user, role and organization
   *     tags: [Auth]
   */
  router.get('/me', auth, async (req, res, next) => {
    try {
      let organization = null;
      if (req.user.organizationId) {
        organization = unwrap(
          await adminClient
            .from('organizations')
            .select('id, name, slug, type, status')
            .eq('id', req.user.organizationId)
            .maybeSingle(),
          'load organization'
        );
      }
      res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        organization,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /api/auth/account-exists:
   *   get:
   *     summary: Whether an account already exists for an email (claim-flow branch)
   *     tags: [Auth]
   *     security: []
   */
  router.get(
    '/account-exists',
    validate(accountExistsSchema, 'query'),
    async (req, res, next) => {
      const { email } = req.validated.query;
      try {
        // Source of truth is `profiles`, not auth.users: a row exists only once
        // an account has been provisioned by our flows.
        const data = unwrap(
          await adminClient
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle(),
          'account-exists lookup'
        );
        res.json({ exists: Boolean(data) });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

/** Default instance wired to the real clients. */
export const authRouter = createAuthRouter();
