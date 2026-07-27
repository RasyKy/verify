export default defineNuxtRouteMiddleware(() => {
  // Auth guard disabled — re-enable by restoring the checks below:
  // const user = useSupabaseUser()
  // if (to.path.startsWith('/issuer') && !user.value) return navigateTo('/login')
  // if (to.path === '/login' && user.value) return navigateTo('/issuer')
})
