/**
 * $fetch instance pointed at the Express API, with the Supabase access token
 * attached.
 *
 * The backend never mints tokens — the browser signs in directly against
 * Supabase Auth (pages/login.vue) and `middleware/auth.js` on the backend only
 * verifies the resulting JWT, locally against the project's JWKS. So the single
 * job here is forwarding that token.
 *
 * Works during SSR too: @nuxtjs/supabase reads the session cookie server-side,
 * so a `useFetch` on the issuer pages is already authenticated on first render.
 *
 * Public endpoints need no token and can use plain `useFetch`/`$fetch` —
 * `GET /api/certificates/verify/:certId`, `/api/registry` and
 * `/api/certificates/:id/qr` are unauthenticated by design (FR-AUTH-04,
 * FR-VERIFY-05).
 */
export interface UseApiOptions {
  /**
   * Bounce to /login when the API answers 401. Off for callers that run inside
   * route middleware, where an extra navigateTo would fight the navigation
   * already in flight (see useMe.ts).
   */
  redirectOn401?: boolean
}

export function useApi(options: UseApiOptions = {}) {
  const { redirectOn401 = true } = options
  const { public: { apiBase } } = useRuntimeConfig()
  const session = useSupabaseSession()

  return $fetch.create({
    baseURL: apiBase,

    onRequest({ options }) {
      const token = session.value?.access_token
      if (token) options.headers.set('Authorization', `Bearer ${token}`)
    },

    onResponseError({ response }) {
      // Session expired or revoked, or the account was deactivated. Bounce to
      // login rather than showing an empty table with no explanation.
      if (redirectOn401 && response.status === 401) {
        clearMe()
        return navigateTo('/login')
      }
    },
  })
}
