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

/** Shared across the route guard and every layout, so /me is fetched once. */
export function useMe() {
  return useState<Me | null>('auth:me', () => null)
}

/**
 * Returns the cached profile, fetching it once per session if needed.
 * Resolves to null when signed out or when the backend refuses the token —
 * callers decide what that means rather than being redirected out from under.
 */
export async function fetchMe(): Promise<Me | null> {
  const me = useMe()
  if (me.value) return me.value

  const session = useSupabaseSession()
  if (!session.value) return null

  try {
    // redirectOn401: false — this runs inside route middleware, where an extra
    // navigateTo would race the navigation already in progress.
    me.value = await useApi({ redirectOn401: false })<Me>('/api/auth/me')
  } catch {
    me.value = null
  }
  return me.value
}

/** Drop the cached profile. Call on logout, and whenever a 401 comes back. */
export function clearMe() {
  useMe().value = null
}
