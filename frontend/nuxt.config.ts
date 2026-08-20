// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@nuxtjs/sitemap', '@nuxtjs/robots'],
  css: ['~/assets/css/main.css'],
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