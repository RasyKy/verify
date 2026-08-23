/**
 * Claim-flow data, backed by the real API.
 *
 * Replaces the TEMPORARY Nitro mocks under server/api/claim/[token]/* and
 * server/api/auth/account-exists.get.ts now that the backend has real
 * endpoints (backend/src/routes/claim.js, routes/auth.js). Talks to the
 * Express API directly through useApi(), same as useCertificates.ts — no
 * Nitro proxy layer (see useApi.ts's header comment for why).
 */

export interface ClaimPreview {
  valid: boolean
  expired: boolean
  used: boolean
  /** Used, but the certificate is still unclaimed — a resend retired this link. */
  superseded: boolean
  studentName: string
  courseName: string
  institutionName: string
  email: string
}

interface AuthErrorLike {
  message?: string
  status?: number
  name?: string
}

/**
 * Human-readable text for a Supabase auth failure.
 *
 * Never surface `error.message` verbatim. For any 5xx, auth-js builds the
 * message from the fetch Response OBJECT rather than its body — see
 * `_getErrorMessage` in @supabase/auth-js/lib/fetch, which falls through to
 * `JSON.stringify(err)` — and a Response has no enumerable own properties. So
 * a server-side failure reaches the UI with `message` set to the literal
 * string "{}", which is what a holder then reads in the red box.
 *
 * The usual trigger is the confirmation email that sign-up requires while the
 * project has mailer_autoconfirm off: if Supabase's mailer rate-limits or
 * fails, GoTrue answers 500 and every sign-up attempt renders as "{}".
 */
export function authErrorMessage(err: AuthErrorLike | null | undefined, fallback: string): string {
  if (!err) return fallback
  const message = typeof err.message === 'string' ? err.message.trim() : ''
  const serverSide =
    (err.status ?? 0) >= 500 ||
    err.name === 'AuthRetryableFetchError' ||
    message === '{}' ||
    message === ''

  if (serverSide) {
    return 'We could not reach the sign-in service just now — that is on our side, not your link. Please try the login code above, or try again in a few minutes.'
  }
  if (/rate limit/i.test(message)) {
    return 'Too many attempts in a short time. Please wait a few minutes and try again.'
  }
  return message
}

/** Shared across the claim page's watchers by a fixed, token-scoped key. */
export function useClaimToken(token: string) {
  const api = useApi()
  const { data: preview, pending, error } = useAsyncData<ClaimPreview>(
    `claim:${token}`,
    () => api<ClaimPreview>(`/api/claim/${token}`),
  )
  return { preview, pending, error }
}

/**
 * Redeems the claim link for the currently signed-in Supabase user.
 * No body: the backend identifies the caller from the bearer token useApi()
 * already attaches, so there's no need to pass a session manually.
 *
 * redirectOn401 is off — an edge-case 401 here should surface inline via the
 * page's own error handling, not yank the user to /login mid-claim.
 */
export function confirmClaim(token: string) {
  return useApi({ redirectOn401: false })(`/api/claim/${token}/confirm`, {
    method: 'POST',
  })
}

/** Whether an account already exists for this email (claim UI branch). */
export function checkAccountExists(email: string) {
  return useApi()<{ exists: boolean }>('/api/auth/account-exists', {
    query: { email },
  })
}
