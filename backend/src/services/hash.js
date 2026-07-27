/**
 * Certificate hashing (FR-ISSUE-03, FR-EXP-04) — the integrity core of the
 * whole product.
 *
 * The hash is computed off-chain here, stored on Polygon as a bytes32, and
 * recomputed from database fields on every verification. If the two disagree,
 * the certificate reads as Invalid. That is the entire tamper-detection
 * mechanism, so this module has exactly one job and no dependencies.
 *
 * ── Why the canonical string is specified this precisely ──
 * "SHA-256 of name + course + date" is not implementable twice. Any
 * disagreement about field order, whitespace, Unicode form or how a null expiry
 * is written produces a different digest — and the symptom is a GENUINE
 * certificate reported as forged. So the format is pinned, versioned, and
 * covered by fixed vectors in tests/hash.test.js.
 *
 *   canonical = [certId, name, course, completionDate, expiryDate].join('|')
 *   hash      = '0x' + sha256(utf8(canonical))
 *
 * Decisions and their reasons:
 *   • certId first — a UUID, so no user input can position-shift the fields.
 *   • '|' separator — cannot appear in a date, and combined with the fixed
 *     field count means a name containing '|' still cannot forge a different
 *     field layout.
 *   • NFC normalisation — "Sophéa" can be encoded as é (U+00E9) or e+◌́
 *     (U+0065 U+0301). Visually identical, different bytes, different hash. The
 *     names here are Khmer and French-influenced, so this is a real case, not a
 *     theoretical one.
 *   • Whitespace collapsed and trimmed — "Chea  Sophat" and "Chea Sophat" must
 *     not be two different certificates.
 *   • NO case folding — names are displayed as typed, so they are hashed as
 *     typed. Case-folding would let "chea sophat" verify against a certificate
 *     issued to "Chea Sophat".
 *   • Empty string for no expiry — never the literal "null" or "0", which are
 *     values a date field could conceivably hold.
 *   • student_email is NOT hashed — it is mutable contact data, not part of the
 *     credential claim. Including it would mean correcting a typo'd email
 *     required a full revoke-and-reissue on chain.
 */
import crypto from 'node:crypto';

/**
 * Current canonical format. Stored per row as `certificate_hashes.hash_version`
 * so the recipe can change later without stranding issued certificates:
 * verification rehashes using the version the row was created with.
 */
export const HASH_VERSION = 1;

/** Field separator. See the header note on why this specific character. */
const SEP = '|';

/**
 * Unicode-normalise and collapse whitespace. Case is deliberately preserved.
 * @param {string} value
 */
export function normalizeText(value) {
  if (typeof value !== 'string') {
    throw new TypeError('normalizeText expects a string');
  }
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * Coerces a date to YYYY-MM-DD.
 *
 * Accepts a Date, a bare 'YYYY-MM-DD', or a full ISO timestamp, because
 * Postgres `date` columns come back as strings via supabase-js while a
 * freshly-built object may hold a Date. All three must hash identically.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string} YYYY-MM-DD, or '' when there is no date
 */
export function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('normalizeDate received an invalid Date');
    }
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) {
    throw new TypeError(
      `normalizeDate expected YYYY-MM-DD, received ${JSON.stringify(value)}`
    );
  }
  return match[0];
}

/**
 * Builds the exact string that gets hashed. Exported so the contract can be
 * inspected, diffed against the blockchain teammate's implementation, and
 * printed when a verification unexpectedly fails.
 *
 * @param {object} cert
 * @param {string} cert.certId          the certificate UUID
 * @param {string} cert.studentName
 * @param {string} cert.courseName
 * @param {string|Date} cert.completionDate
 * @param {string|Date|null} [cert.expiryDate]
 * @returns {string}
 */
export function buildCanonicalString({
  certId,
  studentName,
  courseName,
  completionDate,
  expiryDate = null,
}) {
  if (!certId || typeof certId !== 'string') {
    throw new TypeError('buildCanonicalString requires a certId');
  }

  const completion = normalizeDate(completionDate);
  if (!completion) {
    throw new TypeError('buildCanonicalString requires a completionDate');
  }

  return [
    certId.trim(),
    normalizeText(studentName),
    normalizeText(courseName),
    completion,
    normalizeDate(expiryDate),
  ].join(SEP);
}

/**
 * SHA-256 of the canonical string, as a 0x-prefixed 32-byte hex string ready to
 * pass to the contract as bytes32.
 *
 * Lowercase hex, always: a bytes32 comparison is byte-wise, and mixed case in
 * the database would break the string equality check in verification.
 *
 * @param {Parameters<typeof buildCanonicalString>[0]} cert
 * @returns {string} 0x + 64 lowercase hex characters
 */
export function computeCertificateHash(cert) {
  const canonical = buildCanonicalString(cert);
  const digest = crypto
    .createHash('sha256')
    .update(Buffer.from(canonical, 'utf8'))
    .digest('hex');
  return `0x${digest}`;
}

/**
 * Expiry as Unix seconds for the contract's `expiresAt` argument.
 *
 * 0 means "never" — the contract's sentinel. Uses UTC midnight of the expiry
 * date so the value is reproducible regardless of server timezone, and must
 * agree with the expiry inside the hash or the two records contradict.
 *
 * @param {string|Date|null|undefined} expiryDate
 * @returns {number}
 */
export function expiryToUnix(expiryDate) {
  const normalized = normalizeDate(expiryDate);
  if (!normalized) return 0;
  return Math.floor(Date.parse(`${normalized}T00:00:00.000Z`) / 1000);
}

/**
 * Constant-time hash comparison.
 *
 * Overkill for a public value, but free: it costs one buffer allocation and
 * removes any need to reason about whether an early-exit `===` on a
 * security-relevant comparison could ever leak something.
 *
 * @param {string} a
 * @param {string} b
 */
export function hashesEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a.toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hashes a `certificates` row as stored (snake_case) — the verification path.
 * Kept separate from the camelCase builder so a column rename cannot silently
 * hash `undefined` and report every certificate as forged.
 *
 * @param {object} row a row from the certificates table
 */
export function hashFromRow(row) {
  return computeCertificateHash({
    certId: row.id,
    studentName: row.student_name,
    courseName: row.course_name,
    completionDate: row.completion_date,
    expiryDate: row.expiry_date,
  });
}
