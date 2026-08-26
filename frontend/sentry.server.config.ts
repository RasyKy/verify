/**
 * Sentry initialisation — Nitro (SSR) side. Catches errors thrown while
 * server-rendering a page (e.g. the SSR useFetch on /cert/[certId]), which
 * the client-side config never sees. Same Sentry convention as
 * sentry.client.config.ts: loaded automatically by the @sentry/nuxt module,
 * not imported anywhere.
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
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    sendDefaultPii: false,

    /** Mirrors backend/src/instrument.js's scrubbing (NFR-SEC-02). */
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
