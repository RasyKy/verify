/**
 * The signed-in caller's identity as the BACKEND sees it — role and
 * organization — from `GET /api/auth/me`.
 *
 * Why not read the role off the Supabase session directly: the JWT's
 * `app_metadata.role` only updates on the next token refresh, so a role change
 * or a deactivation could take up to an hour to appear. The backend re-reads the
 * `profiles` table (60s cache) and returns the authoritative answer, which is
 * why a deactivated account can still sign in and yet be refused everywhere.
 *
 * `user_metadata` is writable by the user via `auth.updateUser()`, so it must
 * never drive an authorization decision. This is the only source to branch on.
 */
export type Role = 'admin' | 'issuer' | 'holder'

export interface Organization {
  id: string
  name: string
  slug: string
  type: string
  status: string
}

export interface Me {
  id: string
  email: string
  /** Display label. Null for accounts created through the claim flow. */
  fullName: string | null
  role: Role
  /** null for admins and holders — only issuers belong to an organization. */
  organization: Organization | null
}

/** Best available human label for a signed-in user. */
export function displayName(me: Me | null): string {
  return me?.fullName || me?.email?.split('@')[0] || ''
}

/** Where each role belongs after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/admin',
  issuer: '/issuer',
  holder: '/recipient',
}

/**
 * Why this is a discriminated result rather than `Me | null`.
 *
 * "You are not signed in" and "I could not reach the API" are different facts
 * that demand different responses, and collapsing them is how you get the most
 * confusing possible bug: with the backend stopped, every portal silently
 * bounced to /login, so signing in looked broken when the session was fine all
 * along. `unreachable` exists so that failure names itself.
 */
export type MeResult =
  | { state: 'ok'; me: Me }
  /** No Supabase session — genuinely signed out. */
  | { state: 'signed-out' }
  /** Session is valid but the API rejected it: expired token, or deactivated. */
  | { state: 'refused'; status: number }
  /** The API could not be reached at all. Not an auth problem. */
  | { state: 'unreachable'; message: string }

/** Shared across the route guard and every layout, so /me is fetched once. */
export function useMe() {
  return useState<Me | null>('auth:me', () => null)
}

/** Set when the API is unreachable, so the UI can say so instead of guessing. */
export function useApiUnreachable() {
  return useState<string | null>('auth:api-unreachable', () => null)
}

/**
 * Resolves the caller's profile, fetching it once per session.
 *
 * Never redirects on its own — it runs inside route middleware, where an extra
 * navigateTo would race the navigation already in flight. Callers decide.
 */
export async function resolveMe(): Promise<MeResult> {
  const me = useMe()
  if (me.value) return { state: 'ok', me: me.value }

  const session = useSupabaseSession()
  if (!session.value) return { state: 'signed-out' }

  const unreachable = useApiUnreachable()
  try {
    const result = await useApi({ redirectOn401: false })<Me>('/api/auth/me')
    me.value = result
    unreachable.value = null
    return { state: 'ok', me: result }
  } catch (err) {
    me.value = null
    const status = (err as { status?: number; statusCode?: number })?.status
      ?? (err as { statusCode?: number })?.statusCode

    // A status means the API answered and said no. No status means the request
    // never got an answer — wrong NUXT_PUBLIC_API_BASE, or the backend is down.
    if (status === 401 || status === 403) {
      unreachable.value = null
      return { state: 'refused', status }
    }

    const message = (err as Error)?.message ?? 'Unknown error'
    unreachable.value = message
    return { state: 'unreachable', message }
  }
}

/** Convenience for layouts that only need the profile when it is available. */
export async function fetchMe(): Promise<Me | null> {
  const result = await resolveMe()
  return result.state === 'ok' ? result.me : null
}

/** Drop the cached profile. Call on logout, and whenever a 401 comes back. */
export function clearMe() {
  useMe().value = null
  useApiUnreachable().value = null
}
