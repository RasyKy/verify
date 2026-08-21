/**
 * Public accredited-institution registry (FR-REG-01..03).
 *
 *   GET /api/registry   PUBLIC   accredited, active organizations
 *
 * Drives the landing page's trust bar. Built as a factory so tests inject
 * fakes — jest.mock() does not work under this project's native-ESM Jest
 * (see backend/README.md).
 */
import { Router } from 'express';

import { adminClient as defaultAdminClient, unwrap } from '../config/supabase.js';

export function createRegistryRouter({ adminClient = defaultAdminClient } = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/registry:
   *   get:
   *     summary: List accredited institutions for the public registry
   *     tags: [Registry]
   *     security: []
   */
  router.get('/registry', async (req, res, next) => {
    try {
      const orgs = unwrap(
        await adminClient
          .from('organizations')
          .select('id, name, type, joined_at')
          // `accredited` alone isn't enough — a suspended organization drops
          // off the public "trusted institutions" list even if it was
          // accredited while active, so the landing page never vouches for an
          // org the platform has since suspended.
          .eq('accredited', true)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        'list registry organizations'
      );

      // Cheap and rarely-changing — safe to let intermediaries cache briefly.
      res.set('Cache-Control', 'public, max-age=300');
      res.json(
        (orgs ?? []).map((org) => ({
          id: org.id,
          name: org.name,
          type: org.type,
          joinedAt: org.joined_at,
        }))
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const registryRouter = createRegistryRouter();
