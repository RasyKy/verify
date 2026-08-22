/**
 * The issuer portal's certificates, from the real API.
 *
 * Replaces useIssuerMockData, which kept an in-memory array that looked right
 * and persisted nothing. Every read and write here goes to Supabase, and
 * issuing anchors a hash on Polygon before the row is considered complete.
 *
 * ── Scoping ──
 * There is no organization filter in this file, deliberately. The backend
 * derives the institution from the authenticated issuer's profile and scopes
 * every query to it (see certificateService.list). An issuer therefore cannot
 * see or revoke another institution's certificates even by asking — a filter
 * applied here would be cosmetic, and a second place to get it wrong.
 *
 * The shape mirrors the old mock's so the pages and components consuming it
 * did not have to be rewritten around a new vocabulary.
 */
import { useApi } from '~/composables/useApi'

export interface IssuerCertificate {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  status: 'valid' | 'revoked' | 'expired' | 'unclaimed'
  institution_name: string
  issued_at: string
  revoked_at: string | null
}

/** A row as the API returns it (snake_case, status already derived). */
interface ApiCertificate {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  status: IssuerCertificate['status']
  institution_name: string | null
  created_at: string
  revoked_at: string | null
}

export interface IssueCertInput {
  institution?: string
  studentName: string
  studentEmail: string
  courseName: string
  completionDate: string
  expiryDate: string | null
}

function toDisplay(row: ApiCertificate): IssuerCertificate {
  return {
    id: row.id,
    student_name: row.student_name,
    student_email: row.student_email,
    course_name: row.course_name,
    completion_date: row.completion_date,
    expiry_date: row.expiry_date,
    status: row.status,
    institution_name: row.institution_name ?? '',
    // The mock called this issued_at; the column is created_at.
    issued_at: row.created_at,
    revoked_at: row.revoked_at,
  }
}

const DAY = 86400000
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString().substring(0, 10)
}

export function useIssuerCertificates() {
  const apiFetch = useApi()

  // Shared across the dashboard, the table and the modals, so a certificate
  // issued in one place appears in the others without a page reload.
  const rows = useState<ApiCertificate[]>('issuer:certs', () => [])
  const pending = useState<boolean>('issuer:certs-pending', () => false)
  const error = useState<string | null>('issuer:certs-error', () => null)
  const loaded = useState<boolean>('issuer:certs-loaded', () => false)
  /** Courses typed into the form that no certificate uses yet. */
  const draftCourses = useState<string[]>('issuer:draft-courses', () => [])

  async function refresh() {
    pending.value = true
    error.value = null
    try {
      const res = await apiFetch<{ total: number; certificates: ApiCertificate[] }>(
        '/api/certificates',
      )
      rows.value = res.certificates
      loaded.value = true
    } catch (err) {
      error.value = apiErrorMessage(err, 'Could not load certificates.')
    } finally {
      pending.value = false
    }
  }

  /** Loads once per session; pages can call this unconditionally on mount. */
  async function ensureLoaded() {
    if (loaded.value || pending.value) return
    await refresh()
  }

  const certificates = computed<IssuerCertificate[]>(() =>
    rows.value.map(toDisplay).sort((a, b) => b.issued_at.localeCompare(a.issued_at)),
  )

  const stats = computed(() => {
    const list = certificates.value
    return {
      total: list.length,
      valid: list.filter((c) => c.status === 'valid').length,
      revoked: list.filter((c) => c.status === 'revoked').length,
      expired: list.filter((c) => c.status === 'expired').length,
    }
  })

  /** Course names actually in use, plus any typed but not yet issued against. */
  const courses = computed<string[]>(() => {
    const seen = new Set<string>()
    for (const row of rows.value) seen.add(row.course_name)
    for (const name of draftCourses.value) seen.add(name)
    return [...seen].sort((a, b) => a.localeCompare(b))
  })

  function addCourse(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (courses.value.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
    draftCourses.value.push(trimmed)
  }

  function chartData(rangeDays: number) {
    const buckets = new Map<string, number>()
    for (let i = rangeDays - 1; i >= 0; i--) buckets.set(daysAgo(i), 0)
    for (const row of rows.value) {
      const day = row.created_at.substring(0, 10)
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1)
    }
    return [...buckets.entries()].map(([date, count]) => ({ date, count }))
  }

  const recentActivity = computed(() => {
    const events: Array<{
      type: 'issued' | 'revoked'
      studentName: string
      courseName: string
      timestamp: string
    }> = []
    for (const row of rows.value) {
      events.push({
        type: 'issued',
        studentName: row.student_name,
        courseName: row.course_name,
        timestamp: row.created_at,
      })
      if (row.revoked_at) {
        events.push({
          type: 'revoked',
          studentName: row.student_name,
          courseName: row.course_name,
          timestamp: row.revoked_at,
        })
      }
    }
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)
  })

  /**
   * Issues a certificate. Writes the row to Supabase and anchors its hash on
   * Polygon, so this takes seconds rather than milliseconds — callers must show
   * a pending state and await it.
   *
   * `institution` is accepted for form compatibility and ignored by the
   * backend: the organization comes from the authenticated issuer's profile,
   * never the request body.
   */
  async function issueCertificate(input: IssueCertInput): Promise<IssuerCertificate> {
    const created = await apiFetch<ApiCertificate>('/api/certificates', {
      method: 'POST',
      body: {
        studentName: input.studentName,
        studentEmail: input.studentEmail,
        courseName: input.courseName,
        completionDate: input.completionDate,
        expiryDate: input.expiryDate,
      },
    })
    await refresh()
    return toDisplay(created)
  }

  /** Revokes on chain and in the database. Also slow, for the same reason. */
  async function revokeCertificate(id: string, reason?: string) {
    await apiFetch(`/api/certificates/${id}/revoke`, {
      method: 'POST',
      body: reason ? { reason } : {},
    })
    await refresh()
  }

  return {
    certificates,
    courses,
    stats,
    pending,
    error,
    chartData,
    recentActivity,
    refresh,
    ensureLoaded,
    issueCertificate,
    revokeCertificate,
    addCourse,
  }
}
