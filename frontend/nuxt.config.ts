// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@nuxtjs/sitemap', '@nuxtjs/robots'],
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
    },
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