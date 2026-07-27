/**
 * Blockchain stub tests.
 *
 * The stub is what every other test and all local development runs against, so
 * it must honour the same invariants as blockchain/contracts/Verifier.sol:
 * issue-once, revoke-must-exist, verify-returns-zero-for-unknown. If the stub
 * and the contract ever disagree, code that passes here would fail on-chain.
 */
import { createStubService } from '../src/services/blockchain.js';
import { computeCertificateHash, expiryToUnix } from '../src/services/hash.js';

const CERT = {
  certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  studentName: 'Chea Sophat',
  courseName: 'Web Development Fundamentals',
  completionDate: '2026-02-03',
  expiryDate: null,
};

function freshStub() {
  return createStubService();
}

describe('stub blockchain service', () => {
  it('reports isStub and isEnabled=false', () => {
    const chain = freshStub();
    expect(chain.isStub).toBe(true);
    expect(chain.isEnabled).toBe(false);
  });

  it('verify returns exists:false for an unknown hash (not an error)', async () => {
    const chain = freshStub();
    const result = await chain.verify(computeCertificateHash(CERT));
    expect(result).toEqual({
      exists: false,
      revoked: false,
      issuedAt: 0,
      expiresAt: 0,
    });
  });

  it('issue then verify round-trips', async () => {
    const chain = freshStub();
    const hash = computeCertificateHash(CERT);

    const receipt = await chain.issue(hash, expiryToUnix(CERT.expiryDate));
    expect(receipt.status).toBe('confirmed');
    expect(receipt.txHash).toMatch(/^0x/);
    expect(receipt.blockTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const result = await chain.verify(hash);
    expect(result.exists).toBe(true);
    expect(result.revoked).toBe(false);
    expect(result.issuedAt).toBeGreaterThan(0);
    expect(result.expiresAt).toBe(0); // no expiry
  });

  it('stores expiry as unix seconds', async () => {
    const chain = freshStub();
    const withExpiry = { ...CERT, expiryDate: '2028-02-03' };
    const hash = computeCertificateHash(withExpiry);
    await chain.issue(hash, expiryToUnix(withExpiry.expiryDate));
    const result = await chain.verify(hash);
    expect(result.expiresAt).toBe(expiryToUnix('2028-02-03'));
  });

  it('rejects a double-issue, mirroring the contract require(!exists)', async () => {
    const chain = freshStub();
    const hash = computeCertificateHash(CERT);
    await chain.issue(hash, 0);
    await expect(chain.issue(hash, 0)).rejects.toMatchObject({
      code: 'CHAIN_DUPLICATE',
      status: 409,
    });
  });

  it('revoke flips the flag and verify reflects it', async () => {
    const chain = freshStub();
    const hash = computeCertificateHash(CERT);
    await chain.issue(hash, 0);

    const rec = await chain.revoke(hash);
    expect(rec.status).toBe('confirmed');

    const result = await chain.verify(hash);
    expect(result.revoked).toBe(true);
    expect(result.exists).toBe(true); // revoked, not deleted
  });

  it('rejects revoking a non-existent hash, mirroring the contract', async () => {
    const chain = freshStub();
    await expect(
      chain.revoke(computeCertificateHash(CERT))
    ).rejects.toMatchObject({
      code: 'CHAIN_NOT_FOUND',
      status: 409,
    });
  });

  it('checkIssuerRole is true for the stub', async () => {
    expect(await freshStub().checkIssuerRole()).toBe(true);
  });

  // NOTE: the read-through cache and its invalidation-on-revoke are behaviours
  // of the REAL service only (the stub is already in-memory). Those are covered
  // in tests/cache.test.js (coalescing, TTL, delete).
});
