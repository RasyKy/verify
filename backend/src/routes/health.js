/**
 * Liveness and readiness. Public and unthrottled — Railway's healthcheck polls
 * it continuously, so it must never be rate limited or require auth.
 */
import { Router } from 'express';

import { env } from '../config/env.js';

export const healthRouter = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Liveness probe
 *     tags: [Ops]
 *     security: []
 *     responses:
 *       200:
 *         description: Process is up
 */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.NODE_ENV,
    chainId: env.CHAIN_ID,
    uptimeSeconds: Math.round(process.uptime()),
  });
});
