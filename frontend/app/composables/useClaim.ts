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
