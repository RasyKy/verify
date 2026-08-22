import { fetchCurrentUser, HOME_FOR_ROLE, type Role } from '~/composables/useCurrentUser'

/**
 * Portal access control.
 *
 * Replaces a guard that was short-circuited by an early `return` for local UI
 * work, which left /issuer, /recipient and /admin reachable with no session at
 * all.
 *
 * Two distinct checks, and both are needed:
 *   • Is there a session?      — Supabase answers this in the browser.
 *   • Is it the right role?    — only the backend can answer, because the role
 *     lives in `profiles`, not in the JWT (see useCurrentUser).
 *
 * A session alone is not enough: without the role check, any signed-in holder
 * could open /admin simply by typing the URL.
 *
 * This is NOT the security boundary — the API is (every route carries
 * requireRole, asserted by backend/tests/rbac.matrix.test.js). This guard only
 * keeps people out of pages that would fail to load anything for them anyway.
 */
const PORTALS: { prefix: string; allow: Role[] }[] = [
  { prefix: '/admin', allow: ['admin'] },
  // Admins can open the issuer portal to see what an institution sees; the API
  // scopes what they get back.
  { prefix: '/issuer', allow: ['issuer', 'admin'] },
  { prefix: '/recipient', allow: ['holder', 'issuer', 'admin'] },
]

export default defineNuxtRouteMiddleware(async (to) => {
  // The public verify page must never require a session — that is the entire
  // point of it (anyone can check a certificate, no account needed).
  if (to.path.startsWith('/verify') || to.path.startsWith('/claim')) return

  const portal = PORTALS.find((p) => to.path.startsWith(p.prefix))
  const user = useSupabaseUser()
  const isLogin = to.path === '/login'

  if (!portal && !isLogin) return

  // ── Session check: synchronous, so it is safe on both server and client ──
  if (portal && !user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.path } })
  }
  if (isLogin && !user.value) return

  /**
   * ── Role check: browser only ──
   *
   * It needs a fetch, and awaiting inside middleware during SSR drops the Nuxt
   * instance, so the `navigateTo` after it throws "A composable that requires
   * access to the Nuxt instance was called outside of...". Deferring to the
   * client also avoids the server having to hold the user's access token.
   *
   * Nothing is lost by skipping it server-side: this guard is a convenience,
   * not the security boundary. The API enforces every role itself
   * (backend/tests/rbac.matrix.test.js), so a page that renders for the wrong
   * role simply gets 403s and no data.
   */
  if (import.meta.server) return

  const profile = await fetchCurrentUser()

  if (isLogin) {
    // Already signed in: send them to their own portal rather than showing a
    // login form they do not need.
    return profile ? navigateTo(HOME_FOR_ROLE[profile.role]) : undefined
  }

  if (!profile) {
    // A Supabase session exists but the backend will not honour it — a
    // deactivated account, or a profile that was never provisioned.
    return navigateTo({ path: '/login', query: { redirect: to.path } })
  }

  if (!portal!.allow.includes(profile.role)) {
    // Redirect to where they do belong rather than showing a bare 403; a
    // recipient who clicks an issuer link should land somewhere useful.
    return navigateTo(HOME_FOR_ROLE[profile.role])
  }
})
