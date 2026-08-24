/**
 * Boot-time sanity check on the deployed configuration.
 *
 * `runtimeConfig.public.apiBase` falls back to http://localhost:3001 so `nuxt
 * dev` works with no .env at all. That fallback is convenient locally and
 * invisible in production: a deploy that forgets NUXT_PUBLIC_API_BASE renders
 * every page perfectly and then fails on the first API call, with the browser
 * reporting a connection refused to the *visitor's* own machine.
 *
 * This logs rather than throws — a misconfigured API base still leaves the
 * public verification pages usable, and taking the whole site down would be a
 * worse outcome than a loud line in the deploy log.
 *
 * Deliberately a Nitro runtime plugin and not a check in nuxt.config.ts: CI
 * builds this app with placeholder env (see .github/workflows/ci.yml), so a
 * build-time assertion would fail the pipeline rather than the deploy.
 */
export default defineNitroPlugin(() => {
  if (!import.meta.dev) {
    const { apiBase } = useRuntimeConfig().public

    if (!apiBase || /localhost|127\.0\.0\.1/.test(String(apiBase))) {
      console.error(
        `[verify] NUXT_PUBLIC_API_BASE is "${apiBase || '(unset)'}" in a production build. ` +
          `Every authenticated page will fail to reach the API. ` +
          `Set it to the deployed backend origin in the hosting dashboard.`,
      )
    }
  }
})
