/**
 * Sentry initialisation. MUST be the first thing loaded in the process.
 *
 * Loaded via `node --import ./src/instrument.js src/server.js`. Under ESM all
 * static imports are hoisted and evaluated before the importing module's body
 * runs, so calling `Sentry.init()` from inside app.js would happen *after*
 * Express and the Supabase client were already loaded — too late for Sentry to
 * instrument them. `--import` is the only ordering that works.
 *
 * No-ops when SENTRY_DSN is unset, so local development needs no account.
 */
import * as Sentry from '@sentry/node';

import { env } from './config/env.js';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Sampled rather than 1.0: verification traffic is the high-volume path and
    // full tracing would be noisy and costly for little added insight.
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,
    sendDefaultPii: false,

    /**
     * Last line of defence for PII (NFR-SEC-02). Winston redacts what it logs,
     * but Sentry captures request bodies independently — an issuance payload
     * carries a student's name and email, and must not be shipped to a
     * third-party service verbatim.
     */
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}
