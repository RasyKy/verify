/**
 * Identity endpoints.
 *
 * There is deliberately no POST /login or /refresh here. The Nuxt app
 * authenticates directly against Supabase Auth and supabase-js already handles
 * token storage, rotation and refresh. Re-implementing that in Express would
 * duplicate a security-critical mechanism with a weaker version of itself.
 *
 * What the backend owns is the other half: verifying the resulting token and
 * answering "who is this, what may they do" (see middleware/auth.js).
 */
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { adminClient, unwrap } from '../config/supabase.js';

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Current user, role and organization
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The authenticated caller
 *       401:
 *         description: Missing or invalid token
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  // req.user is already populated from `profiles` by requireAuth; the extra
  // read here is only for the organization the UI needs to display.
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
});
