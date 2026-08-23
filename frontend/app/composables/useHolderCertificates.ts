/**
 * The signed-in holder's own claimed certificates, from the real backend
 * (GET /api/holder/certificates). Replaces useRecipientMockData.ts.
 *
 * Fixed-key useAsyncData so every consumer shares one request/cache, same
 * pattern as useCertificates.ts. `is_hidden` is the real stored value — there
 * is no write endpoint yet (FR-HOLD-06), so any hide/unhide UI stays a
 * local-only overlay in the page, not a mutation on this data.
 */
export interface HolderCertificate {
  id: string
  course_name: string
  institution_name: string | null
  completion_date: string
  expiry_date: string | null
  issued_at: string
  issuedAtBlockchainTimestamp: string | null
  status: 'valid' | 'revoked' | 'expired'
  is_hidden: boolean
}

export function useHolderCertificates() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<HolderCertificate[]>(
    'holder:certificates',
    () => api<HolderCertificate[]>('/api/holder/certificates'),
    { default: () => [] },
  )
  return { certificates: data, pending, refresh, error }
}
