/**
 * Certificate status is always DERIVED, never stored.
 *
 * The database records facts (`claim_state`, `revoked_at`, `expiry_date`); the
 * displayed status is computed from them on every read. Storing a `status`
 * column would mean a certificate silently stays "valid" the day after it
 * expires until some job gets around to updating it.
 *
 * The frontend uses two different vocabularies, and both are load-bearing:
 *
 *   Issuer table  (pages/issuer/certificates.vue, CertificateDetailModal.vue)
 *     'valid' | 'revoked' | 'expired' | 'unclaimed'
 *     Note there is NO 'claimed' chip — a claimed, still-valid certificate
 *     must be reported as 'valid' or the status pill renders blank.
 *
 *   Public verify (components/verify/ResultCard.vue)
 *     'verified' | 'invalid' | 'revoked' | 'expired'
 */

/** @returns {string} today in UTC as YYYY-MM-DD */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Expiry is date-granular, so compare YYYY-MM-DD strings rather than
 * timestamps: a `new Date()` comparison would make a certificate expire hours
 * early or late depending on the server's timezone.
 *
 * A certificate is valid *through* its expiry date, and expires the day after.
 *
 * @param {string|null|undefined} expiryDate YYYY-MM-DD, or null for no expiry
 */
export function isExpired(expiryDate, now = new Date()) {
  if (!expiryDate) return false;
  return String(expiryDate).slice(0, 10) < todayUtc(now);
}

/**
 * Status for the issuer's certificate table.
 *
 * Precedence: revoked → expired → claimed → unclaimed. Revocation outranks
 * expiry because it is a deliberate act by the institution and the more
 * important fact to surface.
 *
 * @param {{ revoked_at?: string|null, expiry_date?: string|null, claim_state?: string }} row
 * @returns {'revoked'|'expired'|'valid'|'unclaimed'}
 */
export function issuerStatus(row, now = new Date()) {
  if (row.revoked_at) return 'revoked';
  if (isExpired(row.expiry_date, now)) return 'expired';
  return row.claim_state === 'claimed' ? 'valid' : 'unclaimed';
}

/**
 * Status for the public verify page (FR-VERIFY-04).
 *
 * Precedence: invalid → revoked → expired → verified. Integrity comes first:
 * if the recomputed hash is absent from the chain or does not match, the stored
 * data is untrustworthy and its revocation/expiry fields mean nothing.
 *
 * @param {object} args
 * @param {boolean} args.existsOnChain  hash found in the registry
 * @param {boolean} args.hashMatches    recomputed hash equals the stored one
 * @param {boolean} args.revokedOnChain registry revocation flag
 * @param {string|null} args.revokedAt  database revocation timestamp
 * @param {string|null} args.expiryDate YYYY-MM-DD or null
 * @returns {'invalid'|'revoked'|'expired'|'verified'}
 */
export function verifyStatus(
  { existsOnChain, hashMatches, revokedOnChain, revokedAt, expiryDate },
  now = new Date()
) {
  if (!hashMatches || !existsOnChain) return 'invalid';
  // Either source counts: the chain is authoritative, but a database
  // revocation whose transaction is still pending must not read as valid.
  if (revokedOnChain || revokedAt) return 'revoked';
  if (isExpired(expiryDate, now)) return 'expired';
  return 'verified';
}

/**
 * Status for the admin certificates table, whose union is narrower
 * (`'issued' | 'revoked'` — see the AdminCert interface in
 * frontend/app/composables/useAdminMockData.ts).
 *
 * @returns {'issued'|'revoked'}
 */
export function adminStatus(row) {
  return row.revoked_at ? 'revoked' : 'issued';
}

/**
 * Maps the `?status=` filter on the issuer list onto the derived value.
 * Filtering happens after derivation because no stored column matches these.
 */
export const ISSUER_STATUS_VALUES = Object.freeze([
  'valid',
  'revoked',
  'expired',
  'unclaimed',
]);
