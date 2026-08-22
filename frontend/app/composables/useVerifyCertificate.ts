/**
 * Public certificate verification against the real API.
 *
 * Replaces the mock lookup that preceded it. The backend recomputes the
 * certificate's hash from the stored fields and compares it with the hash
 * anchored on Polygon, so the status returned here reflects the blockchain,
 * not the database's opinion of itself.
 *
 * The API speaks snake_case; `ResultCard.vue` expects camelCase. That mapping
 * lives here and nowhere else, so the component never has to know what the
 * wire format looks like.
 */

export interface VerifyCertificate {
  studentName: string
  courseName: string
  institutionName: string
  completionDate: string
  expiryDate: string | null
  certId: string
  issuedAtBlockchainTimestamp: string
}

export interface VerifyResult {
  status: 'verified' | 'invalid' | 'revoked' | 'expired'
  certificate: VerifyCertificate | null
}

/** Exactly what GET /api/certificates/verify/:certId returns. */
interface ApiVerifyResponse {
  status: VerifyResult['status']
  certificate: {
    cert_id: string
    student_name: string
    course_name: string
    institution_name: string | null
    completion_date: string
    expiry_date: string | null
    issued_at_blockchain: string | null
    hash: string
    issue_tx_hash: string | null
  } | null
}

function toVerifyResult(response: ApiVerifyResponse): VerifyResult {
  const cert = response.certificate
  if (!cert) return { status: response.status, certificate: null }

  return {
    status: response.status,
    certificate: {
      studentName: cert.student_name,
      courseName: cert.course_name,
      institutionName: cert.institution_name ?? 'Unknown institution',
      completionDate: cert.completion_date,
      expiryDate: cert.expiry_date,
      certId: cert.cert_id,
      issuedAtBlockchainTimestamp: cert.issued_at_blockchain ?? '',
    },
  }
}

/**
 * Fetches a verification result. Never throws for a bad or unknown ID — the
 * API answers `invalid` for those, because a verifier pasting a typo into the
 * search box should see an answer rather than an error page.
 *
 * A genuine failure (network down, API 503) is surfaced through `error` and
 * left for the page to render, since reporting a real certificate as invalid
 * because the service blinked is far worse than admitting it is unreachable.
 */
export function useVerifyCertificate(certId: MaybeRefOrGetter<string>) {
  const { public: config } = useRuntimeConfig()

  const { data, pending, error, refresh } = useFetch<ApiVerifyResponse>(
    () => `/api/certificates/verify/${encodeURIComponent(toValue(certId))}`,
    {
      baseURL: config.apiBase,
      // Verification is a read the visitor triggered; a cached answer could
      // hide a revocation that happened seconds ago.
      key: () => `verify:${toValue(certId)}`,
      server: false,
    },
  )

  const result = computed<VerifyResult | null>(() =>
    data.value ? toVerifyResult(data.value) : null,
  )

  return { result, pending, error, refresh }
}
