/**
 * The signed-in user's role and institution, from the backend.
 *
 * Supabase tells the browser *that* someone is signed in; it does not reliably
 * tell us *what they are*. The role lives in `app_metadata`, which only reaches
 * a JWT on its next refresh — so a freshly invited issuer, or someone whose
 * role or status just changed, can carry a stale claim for up to an hour.
 * GET /api/auth/me reads `profiles`, which is the authority (see
 * backend/src/middleware/auth.js).
 *
 * Cached in `useState` so the route guard does not re-fetch on every
 * navigation, and cleared on sign-out.
 */

export type Role = 'admin' | 'issuer' | 'holder'

export interface CurrentUser {
  id: string
  email: string
  role: Role
  organization: {
    id: string
    name: string
    slug: string
    type: string
    status: string
  } | null
}

/** Where each role belongs when it has not asked for a specific page. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: '/admin',
  issuer: '/issuer',
  holder: '/recipient',
}

export function useCurrentUser() {
  return useState<CurrentUser | null>('current-user', () => null)
}

/**
 * Loads the profile once per session and caches it.
 *
 * Returns null when there is no session, or when the backend refuses the token
 * — a deactivated account still holds a valid, unexpired JWT, and `profiles`
 * is what decides whether it means anything.
 */
export async function fetchCurrentUser(force = false): Promise<CurrentUser | null> {
  // Every Nuxt composable must be called BEFORE the first await. After one,
  // the Nuxt instance is no longer in scope and useRuntimeConfig() throws
  // "A composable that requires access to the Nuxt instance was called
  // outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function".
  // It only bites during SSR, where each request has its own instance —
  // in the browser a singleton papers over the mistake.
  const cached = useCurrentUser()
  const supabase = useSupabaseClient()
  const { public: config } = useRuntimeConfig()

  if (cached.value && !force) return cached.value

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    cached.value = null
    return null
  }

  try {
    cached.value = await $fetch<CurrentUser>('/api/auth/me', {
      baseURL: config.apiBase,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // 401 (bad token) and 403 (deactivated) both mean "no usable session".
    // Treated the same on purpose: the guard should send them to /login either
    // way rather than trying to explain the difference.
    cached.value = null
  }
  return cached.value
}
