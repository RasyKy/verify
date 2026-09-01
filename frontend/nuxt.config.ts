// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    '@sentry/nuxt/module',
  ],
  css: ['~/assets/css/main.css'],
  /**
   * `apiBase` must be declared here or NUXT_PUBLIC_API_BASE in .env is inert —
   * Nuxt only maps NUXT_PUBLIC_* onto keys that already exist in runtimeConfig.
   */
  runtimeConfig: {
    public: {
      // Base URL of the Express API (backend/). Read by useApi().
      //
      // Deliberately NOT a routeRules `/api/**` proxy: this app serves its own
      // Nitro handlers under server/api/, and a blanket proxy would collide with
      // them. The backend's CORS allowlist already permits this origin with
      // `Authorization`, and auth is bearer-token rather than cookie, so there is
      // nothing same-origin would buy us.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
      // Read by sentry.client.config.ts. Empty string, not undefined, when
      // unset — Sentry.init() below treats an empty dsn as "don't send".
      sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
    },
  },
  /**
   * Sentry DSNs are meant to be public (they only ever accept events, never
   * expose data), so this is safe to read client-side — unlike the backend's
   * SENTRY_DSN this is not a secret. Actual init (with the same PII scrubbing
   * the backend uses) lives in sentry.client.config.ts / sentry.server.config.ts,
   * not here.
   *
   * No source-map upload configured — that needs a SENTRY_AUTH_TOKEN this
   * project doesn't have yet. Without it the plugin just logs "no auth
   * token, skipping" at build time rather than failing; add authToken here
   * once that token exists, so Sentry shows real function/line names
   * instead of minified ones.
   */
  sentry: {
    // Skips this module's build step entirely when there's no DSN — the same
    // "no account needed for local dev" default the backend already has.
    enabled: Boolean(process.env.NUXT_PUBLIC_SENTRY_DSN),
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        // PNG first: it is the real brand mark. The .ico stays as the fallback
        // for browsers that ignore the others.
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/logo.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },

        // Bricolage Grotesque carries the headings; the body stays on the
        // system stack, which needs no network round trip.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        /**
         * The landing hero's <h1> — likely this page's LCP element, since it
         * has no hero <img> — renders in this font. Without a direct preload,
         * the browser only discovers the actual .woff2 after fetching AND
         * parsing the stylesheet below: a second round trip sitting on the
         * path to first heading paint, even with the preconnects above.
         *
         * This is the resolved "latin" subset file (the one unrestricted
         * unicode-range, i.e. what actually serves plain English text) for
         * the variable font's full 400-800 weight axis, fetched by hand from
         * the stylesheet response — Google Fonts serves one file per
         * language subset here, not one per weight, since this is a
         * variable font. If Google rotates this URL on a future CDN
         * refresh, this preload just becomes a silent no-op, not a
         * breakage — the stylesheet <link> below still resolves the font
         * normally either way.
         */
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: 'https://fonts.gstatic.com/s/bricolagegrotesque/v9/3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInE.woff2',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap',
        },
      ],
    },
  },
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  routeRules: {
    '/': { prerender: true },
  },
  supabase: {
    redirect: false,
  },
  vite: {
    optimizeDeps: {
      include: ['zod', '@vue/devtools-core', '@vue/devtools-kit'],
    },
  },
})