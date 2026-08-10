// /admin is intentionally left unguarded here: there's no admin login flow
// yet (CLAUDE.md lists admin scope as TBD), so gating it would make the
// portal unreachable rather than protected. Revisit once admin auth exists.
export default defineNuxtRouteMiddleware((to) => {
  // TEMPORARILY disabled for local UI testing without a backend/Supabase
  // connection — delete this early return once frontend/.env has real
  // Supabase credentials to restore the guard below.
  return

  const user = useSupabaseUser()

  const guardedPrefixes = ['/issuer', '/recipient']
  const isGuarded = guardedPrefixes.some((prefix) => to.path.startsWith(prefix))

  if (isGuarded && !user.value) return navigateTo('/login')
  if (to.path === '/login' && user.value) return navigateTo('/issuer')
})
