/**
 * Builds the Express app. Deliberately does NOT call listen() — that belongs to
 * server.js alone, so Supertest can import this module and exercise routes
 * without binding a port. (The code this replaces called listen() from two
 * different files.)
 */
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId, requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';

export function createApp() {
  const app = express();

  /**
   * Railway terminates TLS at its edge, so the client IP arrives in
   * X-Forwarded-For. The hop COUNT is required here — `true` would trust the
   * whole chain, letting a client spoof the header and defeat rate limiting,
   * and express-rate-limit v8 rejects it outright with
   * ERR_ERL_PERMISSIVE_TRUST_PROXY.
   */
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    helmet({
      // The API serves JSON to a separate origin; a restrictive default CSP
      // would only get in Swagger UI's way. Tightened per-route in routes/docs.js.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      // Explicit allowlist — never bare cors(), which reflects any origin.
      origin(origin, callback) {
        // No Origin header: curl, server-to-server, health checks.
        if (!origin) return callback(null, true);
        if (env.allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn('CORS origin rejected', { origin });
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
      exposedHeaders: ['x-request-id'],
      maxAge: 86_400,
    })
  );

  // 10kb: certificate payloads are a handful of short strings. A generous
  // limit here is free memory-exhaustion surface (T-04).
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  app.use(requestLogger);

  // Health is mounted before the limiter so Railway's probe is never throttled.
  app.use('/api', healthRouter);

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);

  // Express 5 removed bare '*' wildcards (path-to-regexp v8) — a named splat
  // is now required or this throws at mount time.
  app.use('/{*splat}', notFoundHandler);
  app.use(errorHandler);

  return app;
}
