/**
 * Sentry initialisation — browser side. Loaded automatically by the
 * @sentry/nuxt module (see the `sentry` key in nuxt.config.ts); this file's
 * name and location are a Sentry convention, not an import anyone writes.
 *
 * No-ops when NUXT_PUBLIC_SENTRY_DSN is unset, mirroring the backend's
 * instrument.js — no Sentry account needed for local dev.
 */
import * as Sentry from '@sentry/nuxt'

const dsn = useRuntimeConfig().public.sentryDsn

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Sampled rather than 1.0 in prod for the same reason as the backend:
    // verify traffic is the high-volume path, full tracing would be noisy.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    sendDefaultPii: false,

    /**
     * Mirrors backend/src/instrument.js's scrubbing (NFR-SEC-02) — a failed
     * issuance or claim request can carry a student's name/email in its
     * body, and that must not ship to a third-party service verbatim.
     */
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies
        delete event.request.data
        if (event.request.headers) {
          delete event.request.headers.authorization
          delete event.request.headers.cookie
        }
      }
      return event
    },
  })
}
