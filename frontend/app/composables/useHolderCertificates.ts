/**
 * The signed-in holder's own claimed certificates, from the real backend
 * (GET /api/holder/certificates). Replaces useRecipientMockData.ts.
 *
 * Fixed-key useAsyncData so every consumer shares one request/cache, same
 * pattern as useCertificates.ts.
 */
export interface HolderCertificate {
  id: string
  course_name: string
  institution_name: string | null
  badge_url: string | null
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

/** FR-HOLD-06. Server is the source of truth — caller refetches after this resolves. */
export function setCertificateVisibility(id: string, is_hidden: boolean) {
  return useApi()(`/api/holder/certificates/${id}`, { method: 'PATCH', body: { is_hidden } })
}
