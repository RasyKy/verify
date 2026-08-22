/**
 * Public verification types.
 *
 * Matches GET /api/certificates/verify/:certId — camelCase, which is what
 * components/verify/ResultCard.vue destructures.
 *
 * Note what is NOT in the status union: there is no "unavailable". A failed
 * request is an HTTP error, handled separately by the page, precisely so an
 * outage can never be rendered through the same path as `invalid`.
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
  /**
   * null when `status` is 'invalid' — both "no such certificate" and "hash
   * mismatch" return this, so a verifier learns the credential cannot be
   * trusted without learning which failure occurred.
   */
  certificate: VerifyCertificate | null
}
