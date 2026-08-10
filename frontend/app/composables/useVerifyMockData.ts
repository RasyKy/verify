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

function fakeCertificate(certId: string): VerifyCertificate {
  return {
    studentName: 'Sokha Chan',
    courseName: 'Web Development Fundamentals',
    institutionName: 'Royal Phnom Penh University',
    completionDate: new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10),
    expiryDate: null,
    certId,
    issuedAtBlockchainTimestamp: new Date(Date.now() - 30 * 86400000 + 3 * 60000).toISOString(),
  }
}

/**
 * Looks up a certificate ID for the public verify page. Checks the two live
 * mock stores first (so certs issued via the issuer portal, or already
 * seeded on the recipient dashboard, verify correctly), then falls back to
 * `valid-`/`revoked-`/`expired-` demo prefixes — the same convention used by
 * the claim page's temporary mock — so any other ID is deterministically
 * demoable rather than always "not found".
 */
export function lookupCertificate(certId: string): VerifyResult {
  const id = certId.trim()
  if (!id) return { status: 'invalid', certificate: null }

  const { certificates: issuerCerts } = useIssuerMockData()
  const issuerMatch = issuerCerts.value.find((c) => c.id === id)
  if (issuerMatch) {
    const status: VerifyResult['status'] =
      issuerMatch.status === 'valid' || issuerMatch.status === 'unclaimed' ? 'verified' : issuerMatch.status
    return {
      status,
      certificate: {
        studentName: issuerMatch.student_name,
        courseName: issuerMatch.course_name,
        institutionName: issuerMatch.institution_name,
        completionDate: issuerMatch.completion_date,
        expiryDate: issuerMatch.expiry_date,
        certId: issuerMatch.id,
        issuedAtBlockchainTimestamp: issuerMatch.issued_at,
      },
    }
  }

  const { certs: recipientCerts, recipient } = useRecipientMockData()
  const recipientMatch = recipientCerts.value.find((c) => c.id === id)
  if (recipientMatch) {
    return {
      status: recipientMatch.status === 'valid' ? 'verified' : recipientMatch.status,
      certificate: {
        studentName: recipient.name,
        courseName: recipientMatch.course_name,
        institutionName: recipientMatch.institution_name,
        completionDate: recipientMatch.completion_date,
        expiryDate: recipientMatch.expiry_date,
        certId: recipientMatch.id,
        issuedAtBlockchainTimestamp: recipientMatch.issuedAtBlockchainTimestamp,
      },
    }
  }

  if (id.startsWith('revoked-')) return { status: 'revoked', certificate: fakeCertificate(id) }
  if (id.startsWith('expired-')) return { status: 'expired', certificate: fakeCertificate(id) }
  if (id.startsWith('valid-')) return { status: 'verified', certificate: fakeCertificate(id) }
  return { status: 'invalid', certificate: null }
}
