/**
 * Status derivation is the contract between the backend and two different
 * frontend vocabularies, so precedence and boundary dates are pinned here.
 */
import {
  isExpired,
  issuerStatus,
  verifyStatus,
  adminStatus,
  todayUtc,
} from '../src/lib/derivedStatus.js';

const NOW = new Date('2026-07-24T12:00:00Z');

describe('isExpired', () => {
  it('treats a null expiry as never expiring', () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired(undefined, NOW)).toBe(false);
    expect(isExpired('', NOW)).toBe(false);
  });

  it('keeps a certificate valid THROUGH its expiry date', () => {
    expect(isExpired('2026-07-24', NOW)).toBe(false);
  });

  it('expires it the following day', () => {
    expect(isExpired('2026-07-23', NOW)).toBe(true);
  });

  it('is not expired well before the date', () => {
    expect(isExpired('2027-01-01', NOW)).toBe(false);
  });

  it('ignores a time component on the stored value', () => {
    expect(isExpired('2026-07-24T00:00:00Z', NOW)).toBe(false);
    expect(isExpired('2026-07-23T23:59:59Z', NOW)).toBe(true);
  });

  it('does not shift the boundary near midnight UTC', () => {
    // A timestamp-based comparison would flip these depending on the server's
    // timezone; a date-string comparison must not.
    expect(isExpired('2026-07-24', new Date('2026-07-24T00:00:00Z'))).toBe(
      false
    );
    expect(isExpired('2026-07-24', new Date('2026-07-24T23:59:59Z'))).toBe(
      false
    );
    expect(isExpired('2026-07-24', new Date('2026-07-25T00:00:00Z'))).toBe(
      true
    );
  });
});

describe('issuerStatus', () => {
  it('reports a claimed, unexpired certificate as valid — there is no "claimed" chip', () => {
    expect(
      issuerStatus(
        { claim_state: 'claimed', expiry_date: null, revoked_at: null },
        NOW
      )
    ).toBe('valid');
  });

  it('reports an unclaimed certificate as unclaimed', () => {
    expect(
      issuerStatus(
        { claim_state: 'unclaimed', expiry_date: null, revoked_at: null },
        NOW
      )
    ).toBe('unclaimed');
  });

  it('ranks revoked above expired', () => {
    expect(
      issuerStatus(
        {
          claim_state: 'claimed',
          expiry_date: '2020-01-01',
          revoked_at: '2026-01-01',
        },
        NOW
      )
    ).toBe('revoked');
  });

  it('ranks revoked above claim state', () => {
    expect(
      issuerStatus(
        {
          claim_state: 'unclaimed',
          expiry_date: null,
          revoked_at: '2026-01-01',
        },
        NOW
      )
    ).toBe('revoked');
  });

  it('reports expiry even when never claimed', () => {
    expect(
      issuerStatus(
        {
          claim_state: 'unclaimed',
          expiry_date: '2020-01-01',
          revoked_at: null,
        },
        NOW
      )
    ).toBe('expired');
  });

  it('only ever returns values the frontend has a chip for', () => {
    const allowed = new Set(['valid', 'revoked', 'expired', 'unclaimed']);
    for (const claim_state of ['claimed', 'unclaimed']) {
      for (const expiry_date of [null, '2020-01-01', '2030-01-01']) {
        for (const revoked_at of [null, '2026-01-01']) {
          expect(allowed).toContain(
            issuerStatus({ claim_state, expiry_date, revoked_at }, NOW)
          );
        }
      }
    }
  });
});

describe('verifyStatus', () => {
  const good = {
    existsOnChain: true,
    hashMatches: true,
    revokedOnChain: false,
    revokedAt: null,
    expiryDate: null,
  };

  it('verifies a matching, unrevoked, unexpired certificate', () => {
    expect(verifyStatus(good, NOW)).toBe('verified');
  });

  it('is invalid when the recomputed hash does not match — tamper detection', () => {
    expect(verifyStatus({ ...good, hashMatches: false }, NOW)).toBe('invalid');
  });

  it('is invalid when the hash is absent from the chain', () => {
    expect(verifyStatus({ ...good, existsOnChain: false }, NOW)).toBe(
      'invalid'
    );
  });

  it('ranks integrity above revocation — a tampered row cannot be trusted to say it is revoked', () => {
    expect(
      verifyStatus({ ...good, hashMatches: false, revokedOnChain: true }, NOW)
    ).toBe('invalid');
  });

  it('ranks integrity above expiry', () => {
    expect(
      verifyStatus(
        { ...good, hashMatches: false, expiryDate: '2020-01-01' },
        NOW
      )
    ).toBe('invalid');
  });

  it('reports revoked from the chain', () => {
    expect(verifyStatus({ ...good, revokedOnChain: true }, NOW)).toBe(
      'revoked'
    );
  });

  it('reports revoked from the database while the transaction is still pending', () => {
    expect(verifyStatus({ ...good, revokedAt: '2026-07-24' }, NOW)).toBe(
      'revoked'
    );
  });

  it('ranks revoked above expired', () => {
    expect(
      verifyStatus(
        { ...good, revokedOnChain: true, expiryDate: '2020-01-01' },
        NOW
      )
    ).toBe('revoked');
  });

  it('reports expired', () => {
    expect(verifyStatus({ ...good, expiryDate: '2020-01-01' }, NOW)).toBe(
      'expired'
    );
  });

  it('only ever returns values ResultCard.vue can render', () => {
    const allowed = new Set(['verified', 'invalid', 'revoked', 'expired']);
    for (const existsOnChain of [true, false]) {
      for (const hashMatches of [true, false]) {
        for (const revokedOnChain of [true, false]) {
          for (const expiryDate of [null, '2020-01-01']) {
            expect(allowed).toContain(
              verifyStatus(
                {
                  existsOnChain,
                  hashMatches,
                  revokedOnChain,
                  revokedAt: null,
                  expiryDate,
                },
                NOW
              )
            );
          }
        }
      }
    }
  });
});

describe('adminStatus', () => {
  it('maps onto the narrower admin union', () => {
    expect(adminStatus({ revoked_at: null })).toBe('issued');
    expect(adminStatus({ revoked_at: '2026-01-01' })).toBe('revoked');
  });
});

describe('todayUtc', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayUtc(NOW)).toBe('2026-07-24');
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
