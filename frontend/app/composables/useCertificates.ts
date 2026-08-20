/**
 * Issuer certificate data, backed by the real API.
 *
 * Replaces useIssuerMockData(). The list is exposed through `useAsyncData` under
 * a fixed key, so every component that calls `useCertificates()` shares one
 * request and one cache entry — the same ergonomics the mock's `useState` store
 * had, which is why the components consuming it barely change.
 *
 * The mock mutated a local array and the table updated itself. Against a real
 * API the server is the source of truth (status is derived there, and issuance
 * assigns the UUID), so mutations return their result and the caller calls
 * `refresh()`. Optimistically patching the local array instead would show a
 * status the server might disagree with.
 */

/** Matches GET /api/certificates — snake_case, status derived server-side. */
export interface IssuerCertificate {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  /** There is deliberately no 'claimed' — a claimed, valid cert reads 'valid'. */
  status: 'valid' | 'revoked' | 'expired' | 'unclaimed'
  institution_id: string
  institution_name: string | null
  issued_at: string
  revoked_at: string | null
}

export interface IssueCertInput {
  /** Sent because the form shows it; the backend discards it and uses the
   *  authenticated issuer's organization instead. */
  institution?: string
  studentName: string
  studentEmail: string
  courseName: string
  completionDate: string
  expiryDate: string | null
}

export type UpdateCertInput = Omit<IssueCertInput, 'institution'>

export interface IssueResult {
  id: string
  status: string
  hash: string
  issue_tx_hash: string | null
  chain_status: 'pending' | 'confirmed'
  /** false means the certificate is valid but the claim email did not go out. */
  claim_email_sent: boolean
}

export interface DashboardData {
  stats: { total: number; valid: number; revoked: number; expired: number }
  chartData: Array<{ date: string; count: number }>
  recentActivity: Array<{
    type: 'issued' | 'revoked' | 'claimed'
    studentName: string
    courseName: string
    timestamp: string
  }>
}

/** The organization's certificates. Shared across components by key. */
export function useCertificates() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<IssuerCertificate[]>(
    'issuer:certificates',
    () => api<IssuerCertificate[]>('/api/certificates'),
    { default: () => [] },
  )
  return { certificates: data, pending, refresh, error }
}

/** The organization's course names, for the form's typeahead. */
export function useCourses() {
  const api = useApi()
  const { data, refresh } = useAsyncData<string[]>(
    'issuer:courses',
    () => api<string[]>('/api/courses'),
    { default: () => [] },
  )
  return { courses: data, refresh }
}

/**
 * Dashboard figures for a range. Refetches when `range` changes rather than
 * slicing a cached list client-side, because the chart series is zero-filled
 * server-side for exactly the requested window.
 */
export function useDashboard(range: Ref<string>) {
  const api = useApi()
  return useAsyncData<DashboardData>(
    'issuer:dashboard',
    () => api<DashboardData>('/api/dashboard', { query: { range: range.value } }),
    {
      watch: [range],
      default: () => ({
        stats: { total: 0, valid: 0, revoked: 0, expired: 0 },
        chartData: [],
        recentActivity: [],
      }),
    },
  )
}

export function issueCertificate(body: IssueCertInput) {
  return useApi()<IssueResult>('/api/certificates', { method: 'POST', body })
}

export function updateCertificate(id: string, body: UpdateCertInput) {
  return useApi()(`/api/certificates/${id}`, { method: 'PUT', body })
}

export function revokeCertificate(id: string, reason?: string) {
  return useApi()(`/api/certificates/${id}/revoke`, {
    method: 'POST',
    body: reason ? { reason } : {},
  })
}

/** Idempotent server-side on (organization, name). */
export function createCourse(name: string) {
  return useApi()<{ id: string; name: string }>('/api/courses', {
    method: 'POST',
    body: { name },
  })
}

/**
 * The message the API actually sent, for a toast.
 *
 * The backend duplicates `message` at the top level of every error body
 * precisely so this stays a one-liner (docs/api-schema.md).
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback
}
