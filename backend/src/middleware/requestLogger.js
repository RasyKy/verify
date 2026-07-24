/**
 * Request correlation and access logging.
 *
 * Every request gets an id that appears in its log lines and in the error
 * response body, so a user reporting "it failed" hands you the exact trace.
 */
import crypto from 'node:crypto';

import { logger } from '../lib/logger.js';

export function requestId(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // 4xx/5xx are logged by errorHandler with far more context; logging them
    // here too would double every failure in the log.
    if (res.statusCode >= 400) return;

    logger.http('request', {
      requestId: req.id,
      method: req.method,
      // originalUrl, not url — query strings matter for /dashboard?range=
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.user?.id,
      role: req.user?.role,
    });
  });

  next();
}
