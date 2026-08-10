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

interface RawCert {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  raw_status: 'valid' | 'revoked' | 'unclaimed'
  institution_name: string
  issued_at: string
  revoked_at: string | null
}

export const DEFAULT_INSTITUTION = 'Royal Phnom Penh University'

const DAY = 86400000
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString().substring(0, 10)
}
function timestampDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString()
}
function todayStr(): string {
  return new Date().toISOString().substring(0, 10)
}

const seedCourses: string[] = [
  'Web Development Fundamentals',
  'Data Analytics with Python',
  'Blockchain for Developers',
  'UX Design Principles',
  'Cloud Computing Foundations',
]

const seedCerts: RawCert[] = [
  { id: 'cert-is-001', student_name: 'Sokha Chan',    student_email: 'sokha.chan@example.com',    course_name: 'Web Development Fundamentals', completion_date: daysAgo(3),   expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(3),  revoked_at: null },
  { id: 'cert-is-002', student_name: 'Vandy Pich',    student_email: 'vandy.pich@example.com',    course_name: 'Data Analytics with Python',    completion_date: daysAgo(6),   expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(6),  revoked_at: null },
  { id: 'cert-is-003', student_name: 'Bora Sok',      student_email: 'bora.sok@example.com',      course_name: 'Blockchain for Developers',     completion_date: daysAgo(10),  expiry_date: daysAgo(-365), raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(10), revoked_at: null },
  { id: 'cert-is-004', student_name: 'Chenda Ly',     student_email: 'chenda.ly@example.com',     course_name: 'UX Design Principles',          completion_date: daysAgo(14),  expiry_date: null,          raw_status: 'revoked',   institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(14), revoked_at: timestampDaysAgo(2) },
  { id: 'cert-is-005', student_name: 'Dara Meas',     student_email: 'dara.meas@example.com',     course_name: 'Cloud Computing Foundations',   completion_date: daysAgo(20),  expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(20), revoked_at: null },
  { id: 'cert-is-006', student_name: 'Sreymom Heng',  student_email: 'sreymom.heng@example.com',  course_name: 'Web Development Fundamentals', completion_date: daysAgo(2),   expiry_date: daysAgo(730),  raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(2),  revoked_at: null },
  { id: 'cert-is-007', student_name: 'Rithy Chea',    student_email: 'rithy.chea@example.com',    course_name: 'Data Analytics with Python',    completion_date: daysAgo(25),  expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(25), revoked_at: null },
  { id: 'cert-is-008', student_name: 'Kanha Nov',     student_email: 'kanha.nov@example.com',     course_name: 'Blockchain for Developers',     completion_date: daysAgo(45),  expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(45), revoked_at: null },
  { id: 'cert-is-009', student_name: 'Panha Uy',      student_email: 'panha.uy@example.com',      course_name: 'UX Design Principles',          completion_date: daysAgo(60),  expiry_date: null,          raw_status: 'unclaimed', institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(60), revoked_at: null },
  { id: 'cert-is-010', student_name: 'Thida Ros',     student_email: 'thida.ros@example.com',     course_name: 'Cloud Computing Foundations',   completion_date: daysAgo(80),  expiry_date: null,          raw_status: 'valid',     institution_name: DEFAULT_INSTITUTION, issued_at: timestampDaysAgo(80), revoked_at: null },
]

function deriveStatus(raw: RawCert): IssuerCertificate['status'] {
  if (raw.raw_status === 'revoked') return 'revoked'
  if (raw.raw_status === 'unclaimed') return 'unclaimed'
  if (raw.expiry_date && raw.expiry_date < todayStr()) return 'expired'
  return 'valid'
}

function toDisplay(raw: RawCert): IssuerCertificate {
  return { ...raw, status: deriveStatus(raw) }
}

export interface IssueCertInput {
  institution: string
  studentName: string
  studentEmail: string
  courseName: string
  completionDate: string
  expiryDate: string | null
}

export interface UpdateCertInput {
  studentName: string
  studentEmail: string
  courseName: string
  completionDate: string
  expiryDate: string | null
}

export function useIssuerMockData() {
  const rawCerts = useState<RawCert[]>('issuer:certs', () => JSON.parse(JSON.stringify(seedCerts)))
  const courses = useState<string[]>('issuer:courses', () => [...seedCourses])

  const certificates = computed<IssuerCertificate[]>(() =>
    rawCerts.value.map(toDisplay).sort((a, b) => b.issued_at.localeCompare(a.issued_at)),
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

  function chartData(rangeDays: number) {
    const buckets = new Map<string, number>()
    for (let i = rangeDays - 1; i >= 0; i--) buckets.set(daysAgo(i), 0)
    for (const cert of rawCerts.value) {
      const day = cert.issued_at.substring(0, 10)
      if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1)
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
  }

  const recentActivity = computed(() => {
    const events: Array<{ type: 'issued' | 'revoked'; studentName: string; courseName: string; timestamp: string }> = []
    for (const cert of rawCerts.value) {
      events.push({ type: 'issued', studentName: cert.student_name, courseName: cert.course_name, timestamp: cert.issued_at })
      if (cert.revoked_at) {
        events.push({ type: 'revoked', studentName: cert.student_name, courseName: cert.course_name, timestamp: cert.revoked_at })
      }
    }
    return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)
  })

  function issueCertificate(input: IssueCertInput): IssuerCertificate {
    const raw: RawCert = {
      id: `cert-is-${Date.now()}`,
      student_name: input.studentName,
      student_email: input.studentEmail,
      course_name: input.courseName,
      completion_date: input.completionDate,
      expiry_date: input.expiryDate,
      raw_status: 'valid',
      institution_name: input.institution,
      issued_at: new Date().toISOString(),
      revoked_at: null,
    }
    rawCerts.value.unshift(raw)
    return toDisplay(raw)
  }

  // Backend semantics are revoke-original + issue-new on edit (hash includes
  // every field, so any change invalidates the old on-chain hash); this mock
  // simplifies to an in-place field update since there's no chain to reconcile.
  function updateCertificate(id: string, input: UpdateCertInput) {
    const raw = rawCerts.value.find((c) => c.id === id)
    if (!raw) return
    raw.student_name = input.studentName
    raw.student_email = input.studentEmail
    raw.course_name = input.courseName
    raw.completion_date = input.completionDate
    raw.expiry_date = input.expiryDate
  }

  function revokeCertificate(id: string) {
    const raw = rawCerts.value.find((c) => c.id === id)
    if (!raw || raw.raw_status === 'revoked') return
    raw.raw_status = 'revoked'
    raw.revoked_at = new Date().toISOString()
  }

  function addCourse(name: string) {
    if (!courses.value.some((c) => c.toLowerCase() === name.toLowerCase())) {
      courses.value.push(name)
    }
  }

  return {
    certificates, courses, stats, chartData, recentActivity,
    issueCertificate, updateCertificate, revokeCertificate, addCourse,
  }
}
