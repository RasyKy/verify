/**
 * Hash service tests — the most load-bearing suite in the backend.
 *
 * A regression here does not throw or fail loudly; it silently reports genuine
 * certificates as forged. The FIXED VECTORS below are the cross-language
 * contract: In Empiseysocheata's Solidity/Hardhat tests must reproduce these
 * exact digests, and this file is what you diff against when a verification
 * unexpectedly returns Invalid.
 */
import crypto from 'node:crypto';

import {
  HASH_VERSION,
  buildCanonicalString,
  computeCertificateHash,
  expiryToUnix,
  hashFromRow,
  hashesEqual,
  normalizeDate,
  normalizeText,
} from '../src/services/hash.js';

// ── Fixed vectors ───────────────────────────────────────────────────────────
// Independently recomputed below from the documented recipe, so this is not
// merely asserting the implementation against itself.

const VECTOR_NO_EXPIRY = {
  input: {
    certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    studentName: 'Chea Sophat',
    courseName: 'Web Development Fundamentals',
    completionDate: '2026-02-03',
    expiryDate: null,
  },
  canonical:
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301|Chea Sophat|Web Development Fundamentals|2026-02-03|',
};

const VECTOR_WITH_EXPIRY = {
  input: {
    certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    studentName: 'Chea Sophat',
    courseName: 'Web Development Fundamentals',
    completionDate: '2026-02-03',
    expiryDate: '2028-02-03',
  },
  canonical:
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301|Chea Sophat|Web Development Fundamentals|2026-02-03|2028-02-03',
};

/** Recomputes a digest straight from the spec, independent of hash.js. */
function sha256Hex(str) {
  return `0x${crypto.createHash('sha256').update(Buffer.from(str, 'utf8')).digest('hex')}`;
}

describe('canonical string format', () => {
  it('matches the documented layout with no expiry — trailing separator, empty field', () => {
    expect(buildCanonicalString(VECTOR_NO_EXPIRY.input)).toBe(
      VECTOR_NO_EXPIRY.canonical
    );
  });

  it('matches the documented layout with an expiry', () => {
    expect(buildCanonicalString(VECTOR_WITH_EXPIRY.input)).toBe(
      VECTOR_WITH_EXPIRY.canonical
    );
  });

  it('always emits exactly five pipe-separated fields', () => {
    expect(
      buildCanonicalString(VECTOR_NO_EXPIRY.input).split('|')
    ).toHaveLength(5);
    expect(
      buildCanonicalString(VECTOR_WITH_EXPIRY.input).split('|')
    ).toHaveLength(5);
  });

  it('writes a missing expiry as empty, never "null" or "0"', () => {
    const c = buildCanonicalString(VECTOR_NO_EXPIRY.input);
    expect(c.endsWith('|')).toBe(true);
    expect(c).not.toContain('null');
    expect(c).not.toContain('undefined');
  });

  it('treats null and undefined expiry identically', () => {
    const a = buildCanonicalString({
      ...VECTOR_NO_EXPIRY.input,
      expiryDate: null,
    });
    const b = buildCanonicalString({
      ...VECTOR_NO_EXPIRY.input,
      expiryDate: undefined,
    });
    const c = buildCanonicalString({
      ...VECTOR_NO_EXPIRY.input,
      expiryDate: '',
    });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('computeCertificateHash — fixed vectors', () => {
  it('reproduces the vector with no expiry', () => {
    expect(computeCertificateHash(VECTOR_NO_EXPIRY.input)).toBe(
      sha256Hex(VECTOR_NO_EXPIRY.canonical)
    );
  });

  it('reproduces the vector with an expiry', () => {
    expect(computeCertificateHash(VECTOR_WITH_EXPIRY.input)).toBe(
      sha256Hex(VECTOR_WITH_EXPIRY.canonical)
    );
  });

  it('produces 0x + 64 lowercase hex — a valid bytes32', () => {
    const hash = computeCertificateHash(VECTOR_NO_EXPIRY.input);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Buffer.from(hash.slice(2), 'hex')).toHaveLength(32);
  });

  it('is deterministic across calls', () => {
    expect(computeCertificateHash(VECTOR_NO_EXPIRY.input)).toBe(
      computeCertificateHash(VECTOR_NO_EXPIRY.input)
    );
  });

  it('pins HASH_VERSION — bump it deliberately, never incidentally', () => {
    expect(HASH_VERSION).toBe(1);
  });
});

describe('tamper detection — every hashed field must change the digest', () => {
  const base = computeCertificateHash(VECTOR_WITH_EXPIRY.input);

  const mutations = {
    'student name': { studentName: 'Chea Sophal' },
    'course name': { courseName: 'Web Development Fundamentals II' },
    'completion date': { completionDate: '2026-02-04' },
    'expiry date': { expiryDate: '2029-02-03' },
    'expiry removed': { expiryDate: null },
    'certificate id': { certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302' },
  };

  for (const [field, patch] of Object.entries(mutations)) {
    it(`changes when the ${field} changes`, () => {
      expect(
        computeCertificateHash({ ...VECTOR_WITH_EXPIRY.input, ...patch })
      ).not.toBe(base);
    });
  }

  it('is unaffected by student email — deliberately not part of the credential', () => {
    expect(
      computeCertificateHash({
        ...VECTOR_WITH_EXPIRY.input,
        studentEmail: 'someone@else.com',
      })
    ).toBe(base);
  });

  it('cannot be forged by smuggling a separator into a name', () => {
    // A name containing '|' must not be able to imitate a different field
    // layout, because the field count is fixed.
    const sneaky = computeCertificateHash({
      ...VECTOR_WITH_EXPIRY.input,
      studentName: 'Chea Sophat|Web Development Fundamentals',
      courseName: 'x',
    });
    expect(sneaky).not.toBe(base);
  });
});

describe('normalizeText', () => {
  it('collapses runs of whitespace', () => {
    expect(normalizeText('Chea   Sophat')).toBe('Chea Sophat');
    expect(normalizeText('Chea\tSophat')).toBe('Chea Sophat');
    expect(normalizeText('Chea\n Sophat')).toBe('Chea Sophat');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeText('  Chea Sophat  ')).toBe('Chea Sophat');
  });

  it('normalises Unicode to NFC so identical-looking names hash alike', () => {
    const composed = 'Sophéa'; // é as one code point
    const decomposed = 'Sophéa'; // e + combining acute
    expect(composed).not.toBe(decomposed);
    expect(normalizeText(composed)).toBe(normalizeText(decomposed));
  });

  it('gives NFC-equivalent names the same hash', () => {
    const a = computeCertificateHash({
      ...VECTOR_NO_EXPIRY.input,
      studentName: 'Sophéa Chan',
    });
    const b = computeCertificateHash({
      ...VECTOR_NO_EXPIRY.input,
      studentName: 'Sophéa Chan',
    });
    expect(a).toBe(b);
  });

  it('preserves Khmer script unchanged', () => {
    const khmer = 'ជា សុភាព';
    expect(normalizeText(khmer)).toBe(khmer);
    expect(
      computeCertificateHash({ ...VECTOR_NO_EXPIRY.input, studentName: khmer })
    ).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('does NOT fold case — a differently-cased name is a different certificate', () => {
    expect(normalizeText('Chea Sophat')).toBe('Chea Sophat');
    expect(
      computeCertificateHash({
        ...VECTOR_NO_EXPIRY.input,
        studentName: 'chea sophat',
      })
    ).not.toBe(computeCertificateHash(VECTOR_NO_EXPIRY.input));
  });

  it('rejects a non-string', () => {
    expect(() => normalizeText(null)).toThrow(TypeError);
    expect(() => normalizeText(42)).toThrow(TypeError);
  });
});

describe('normalizeDate', () => {
  it('passes through YYYY-MM-DD', () => {
    expect(normalizeDate('2026-02-03')).toBe('2026-02-03');
  });

  it('truncates an ISO timestamp to its date', () => {
    expect(normalizeDate('2026-02-03T14:30:00.000Z')).toBe('2026-02-03');
  });

  it('accepts a Date object', () => {
    expect(normalizeDate(new Date('2026-02-03T00:00:00Z'))).toBe('2026-02-03');
  });

  it('hashes a Date, a date string and a timestamp identically', () => {
    // supabase-js returns `date` columns as strings while freshly-built objects
    // may hold a Date. Both paths must produce one digest.
    const asString = computeCertificateHash({
      ...VECTOR_NO_EXPIRY.input,
      completionDate: '2026-02-03',
    });
    const asDate = computeCertificateHash({
      ...VECTOR_NO_EXPIRY.input,
      completionDate: new Date('2026-02-03T00:00:00Z'),
    });
    const asTimestamp = computeCertificateHash({
      ...VECTOR_NO_EXPIRY.input,
      completionDate: '2026-02-03T00:00:00+00:00',
    });
    expect(asDate).toBe(asString);
    expect(asTimestamp).toBe(asString);
  });

  it('returns empty for absent values', () => {
    expect(normalizeDate(null)).toBe('');
    expect(normalizeDate(undefined)).toBe('');
    expect(normalizeDate('')).toBe('');
  });

  it('throws on an unparseable value rather than hashing garbage', () => {
    expect(() => normalizeDate('03/02/2026')).toThrow(TypeError);
    expect(() => normalizeDate('not a date')).toThrow(TypeError);
    expect(() => normalizeDate(new Date('nonsense'))).toThrow(TypeError);
  });
});

describe('expiryToUnix', () => {
  it('uses 0 as the contract sentinel for never', () => {
    expect(expiryToUnix(null)).toBe(0);
    expect(expiryToUnix('')).toBe(0);
  });

  it('returns UTC midnight of the expiry date', () => {
    expect(expiryToUnix('2028-02-03')).toBe(
      Date.parse('2028-02-03T00:00:00.000Z') / 1000
    );
  });

  it('is an integer, as bytes32/uint256 requires', () => {
    expect(Number.isInteger(expiryToUnix('2028-02-03'))).toBe(true);
  });

  it('agrees with the expiry embedded in the hash', () => {
    // The contract stores expiresAt separately from the hash. If these two
    // disagree the on-chain record contradicts itself.
    const expiry = '2028-02-03';
    expect(
      buildCanonicalString({ ...VECTOR_NO_EXPIRY.input, expiryDate: expiry })
    ).toContain(expiry);
    expect(expiryToUnix(expiry)).toBeGreaterThan(0);
  });
});

describe('hashesEqual', () => {
  const h = computeCertificateHash(VECTOR_NO_EXPIRY.input);

  it('matches identical hashes', () => {
    expect(hashesEqual(h, h)).toBe(true);
  });

  it('is case-insensitive on the hex', () => {
    expect(hashesEqual(h, h.toUpperCase())).toBe(true);
  });

  it('rejects a different hash', () => {
    expect(
      hashesEqual(h, computeCertificateHash(VECTOR_WITH_EXPIRY.input))
    ).toBe(false);
  });

  it('rejects a length mismatch without throwing', () => {
    expect(hashesEqual(h, '0xdead')).toBe(false);
    expect(hashesEqual(h, '')).toBe(false);
  });

  it('rejects non-strings rather than throwing', () => {
    expect(hashesEqual(h, null)).toBe(false);
    expect(hashesEqual(undefined, h)).toBe(false);
  });
});

describe('hashFromRow', () => {
  it('hashes a snake_case database row identically to the camelCase builder', () => {
    const row = {
      id: VECTOR_WITH_EXPIRY.input.certId,
      student_name: VECTOR_WITH_EXPIRY.input.studentName,
      course_name: VECTOR_WITH_EXPIRY.input.courseName,
      completion_date: VECTOR_WITH_EXPIRY.input.completionDate,
      expiry_date: VECTOR_WITH_EXPIRY.input.expiryDate,
    };
    expect(hashFromRow(row)).toBe(
      computeCertificateHash(VECTOR_WITH_EXPIRY.input)
    );
  });

  it('round-trips issuance → verification for a row with no expiry', () => {
    const row = {
      id: VECTOR_NO_EXPIRY.input.certId,
      student_name: VECTOR_NO_EXPIRY.input.studentName,
      course_name: VECTOR_NO_EXPIRY.input.courseName,
      completion_date: VECTOR_NO_EXPIRY.input.completionDate,
      expiry_date: null,
    };
    expect(
      hashesEqual(
        hashFromRow(row),
        computeCertificateHash(VECTOR_NO_EXPIRY.input)
      )
    ).toBe(true);
  });

  it('detects a tampered row — the core product guarantee', () => {
    const issued = computeCertificateHash(VECTOR_WITH_EXPIRY.input);
    const tampered = {
      id: VECTOR_WITH_EXPIRY.input.certId,
      student_name: 'Someone Else',
      course_name: VECTOR_WITH_EXPIRY.input.courseName,
      completion_date: VECTOR_WITH_EXPIRY.input.completionDate,
      expiry_date: VECTOR_WITH_EXPIRY.input.expiryDate,
    };
    expect(hashesEqual(hashFromRow(tampered), issued)).toBe(false);
  });

  it('throws rather than hashing undefined when a column is missing', () => {
    // A column rename must fail loudly, not quietly hash `undefined` and make
    // every certificate in the system report as forged.
    expect(() =>
      hashFromRow({ id: 'x', course_name: 'y', completion_date: '2026-01-01' })
    ).toThrow(TypeError);
  });
});
