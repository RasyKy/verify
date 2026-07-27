export interface RecipientCert {
  id: string
  course_name: string
  institution_name: string
  completion_date: string
  expiry_date: string | null
  issued_at: string
  issuedAtBlockchainTimestamp: string
  status: 'valid' | 'revoked' | 'expired'
  hash: string
  hidden: boolean
}

// `hidden` is mock, client-side listing-visibility state only — there is no
// `hidden`/`private` column in the documented certificates schema yet, and
// neither /verify nor the future /cert/[cert-id] page reads this flag. Per
// CLAUDE.md's constraint, hidden certs must stay verifiable via direct URL,
// so this never gates access — it only drives what this dashboard labels.
const seedCerts: RecipientCert[] = [
  {
    id: 'rcpt-001',
    course_name: 'Bachelor of Computer Science',
    institution_name: 'Royal University of Phnom Penh',
    completion_date: '2024-11-15',
    expiry_date: null,
    issued_at: '2024-11-20T09:12:00Z',
    issuedAtBlockchainTimestamp: '2024-11-20T09:14:32Z',
    status: 'valid',
    hash: '7a3f9c2e1b8d4560a1f2e3d4c5b6a7980f1e2d3c4b5a69788f7e6d5c4b3a2918',
    hidden: false,
  },
  {
    id: 'rcpt-002',
    course_name: 'Diploma in Civil Engineering',
    institution_name: 'Institute of Technology of Cambodia',
    completion_date: '2023-06-30',
    expiry_date: null,
    issued_at: '2023-07-02T14:03:00Z',
    issuedAtBlockchainTimestamp: '2023-07-02T14:05:11Z',
    status: 'valid',
    hash: '2c8e1f7a9b3d4506e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
    hidden: true,
  },
  {
    id: 'rcpt-003',
    course_name: 'Certificate in Business Administration',
    institution_name: 'National University of Management',
    completion_date: '2022-03-10',
    expiry_date: '2025-03-12',
    issued_at: '2022-03-12T10:00:00Z',
    issuedAtBlockchainTimestamp: '2022-03-12T10:01:47Z',
    status: 'expired',
    hash: '4e1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f',
    hidden: false,
  },
  {
    id: 'rcpt-004',
    course_name: 'ACCA Foundations in Financial Accounting',
    institution_name: 'CamEd Business School',
    completion_date: '2023-09-01',
    expiry_date: null,
    issued_at: '2023-09-05T08:30:00Z',
    issuedAtBlockchainTimestamp: '2023-09-05T08:32:09Z',
    status: 'revoked',
    hash: '9f8e7d6c5b4a392817f6e5d4c3b2a190817f6e5d4c3b2a190817f6e5d4c3b2a1',
    hidden: false,
  },
  {
    id: 'rcpt-005',
    course_name: 'Certificate in Legal English',
    institution_name: 'Paragon International University',
    completion_date: '2025-05-20',
    expiry_date: null,
    issued_at: '2025-05-25T11:15:00Z',
    issuedAtBlockchainTimestamp: '2025-05-25T11:16:58Z',
    status: 'valid',
    hash: '1b2c3d4e5f60718293a4b5c6d7e8f900a1b2c3d4e5f60718293a4b5c6d7e8f9',
    hidden: true,
  },
]

export function useRecipientMockData() {
  const certs = useState<RecipientCert[]>('recipient:certs', () => JSON.parse(JSON.stringify(seedCerts)))

  // Static mock identity — matches the "Sokha Chan" persona used in the
  // claim page's temporary mock, for narrative consistency across the demo.
  const recipient = { name: 'Sokha Chan', email: 'sokha.chan@example.com' }

  const totalCerts = computed(() => certs.value.length)
  const hiddenCount = computed(() => certs.value.filter((c) => c.hidden).length)
  const publicCount = computed(() => certs.value.filter((c) => !c.hidden).length)

  function toggleHidden(id: string) {
    const cert = certs.value.find((c) => c.id === id)
    if (!cert) return
    cert.hidden = !cert.hidden
  }

  return { certs, recipient, totalCerts, hiddenCount, publicCount, toggleHidden }
}
