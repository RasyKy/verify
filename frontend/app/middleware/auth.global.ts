/**
 * Portal route guard.
 *
 * Two checks, because signed-in is not the same as permitted: a holder with a
 * perfectly valid session must not reach /admin. The role comes from
 * `GET /api/auth/me` (the `profiles` table), never from the JWT claim or
 * `user_metadata` — see useMe.ts.
 *
 * This is defence in depth, not the security boundary. The backend rejects
 * unauthorised *data* requests regardless of what the browser renders; the guard
 * exists so an unauthorised visitor sees the login page instead of an empty
 * portal shell.
 */
import type { Role } from '~/composables/useMe'

const GUARDED: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '/issuer', roles: ['issuer'] },
  { prefix: '/recipient', roles: ['holder'] },
  { prefix: '/admin', roles: ['admin'] },
]

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  // Already signed in and heading to /login: send them to their own portal.
  if (to.path === '/login') {
    if (!user.value) return
    const result = await resolveMe()
    if (result.state === 'ok') return navigateTo(ROLE_HOME[result.me.role] ?? '/')
    // Refused or unreachable — stay on /login, which renders the reason.
    return
  }

  const guard = GUARDED.find((g) => to.path.startsWith(g.prefix))
  if (!guard) return

  const toLogin = () => navigateTo({ path: '/login', query: { redirect: to.path } })

  if (!user.value) return toLogin()

  const result = await resolveMe()

  if (result.state === 'unreachable') {
    // Do NOT bounce to /login. The session is fine; the API is not reachable,
    // and sending them to a login page they would sign into successfully — only
    // to be bounced again — is an unbreakable loop with no explanation.
    throw createError({
      statusCode: 503,
      statusMessage: 'Cannot reach the API',
      message:
        `The Verify API at ${useRuntimeConfig().public.apiBase} is not responding. ` +
        `Start the backend (cd backend && npm run dev), then reload. (${result.message})`,
      fatal: true,
    })
  }

  if (result.state !== 'ok') return toLogin()

  // Signed in as the wrong role — send them where they do belong, rather than
  // to a login page they are already past.
  if (!guard.roles.includes(result.me.role)) {
    return navigateTo(ROLE_HOME[result.me.role] ?? '/')
  }
})
