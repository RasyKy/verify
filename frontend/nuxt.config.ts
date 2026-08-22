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
      apiBase: 'http://localhost:3001',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        // SVG first: browsers that support it take it and ignore the .ico,
        // which stays as the fallback for the ones that don't.
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
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