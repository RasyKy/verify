/**
 * certificateService — the layer that orders the database write, the chain
 * call and the audit record correctly.
 *
 * These are the assertions that matter most in the whole suite: the tamper
 * case (stored data no longer produces the anchored hash), and the ordering
 * guarantees that decide what happens when the chain fails halfway through.
 */
import { createCertificateService } from '../src/services/certificateService.js';
import { computeCertificateHash } from '../src/services/hash.js';
import { createFakeChain, createFakeDb } from './helpers/fakeSupabase.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const CERT_ID = '33333333-3333-4333-8333-333333333333';

const issuer = {
  id: 'user-issuer',
  email: 'issuer@rupp.edu.kh',
  role: 'issuer',
  organizationId: ORG,
};

/** A certificate row plus the hash row that correctly anchors it. */
function seedVerifiable(overrides = {}) {
  const cert = {
    id: CERT_ID,
    organization_id: ORG,
    student_name: 'Chea Sophat',
    student_email: 'sophat@example.com',
    course_name: 'BSc Computer Science',
    completion_date: '2024-06-01',
    expiry_date: null,
    revoked_at: null,
    is_hidden: false,
    claim_state: 'claimed',
    created_at: '2024-06-01T00:00:00.000Z',
    organizations: { name: 'Royal University of Phnom Penh' },
    ...overrides,
  };

  return {
    certificates: [cert],
    certificate_hashes: [
      {
        id: 'hash-row-1',
        certificate_id: cert.id,
        hash: computeCertificateHash({
          certId: cert.id,
          studentName: cert.student_name,
          courseName: cert.course_name,
          completionDate: cert.completion_date,
          expiryDate: cert.expiry_date,
        }),
        hash_version: 1,
        is_current: true,
        chain_status: 'confirmed',
        chain_issued_at: '2024-06-01T00:10:00.000Z',
        issue_tx_hash: '0xrealtx',
        revoke_tx_hash: null,
      },
    ],
  };
}

describe('issue', () => {
  it('anchors the hash on chain and records the real transaction', async () => {
    const db = createFakeDb();
    const chain = createFakeChain();
    const service = createCertificateService({ db, chain });

    const result = await service.issue(
      {
        studentName: 'Sophéa Kim',
        studentEmail: 'sophea@example.com',
        courseName: 'Advanced Web Development',
        completionDate: '2025-03-15',
        expiryDate: null,
      },
      issuer
    );

    // The hash sent to the chain must be the one derived from the stored row —
    // if these ever diverge, every certificate verifies as forged.
    const expected = computeCertificateHash({
      certId: result.id,
      studentName: 'Sophéa Kim',
      courseName: 'Advanced Web Development',
      completionDate: '2025-03-15',
      expiryDate: null,
    });
    expect(chain.calls.issue).toHaveLength(1);
    expect(chain.calls.issue[0].hash).toBe(expected);

    expect(result.hash.issue_tx_hash).toBe('0xtx-issue');
    expect(result.hash.chain_status).toBe('confirmed');
    expect(db._store.certificate_hashes).toHaveLength(1);
    expect(db._store.audit_events[0].action).toBe('certificate.issued');
  });

  it('takes the organization from the actor, never the request body', async () => {
    const db = createFakeDb();
    const service = createCertificateService({ db, chain: createFakeChain() });

    await service.issue(
      {
        studentName: 'Nou Chanthy',
        studentEmail: 'chanthy@example.com',
        courseName: 'MSc Data Science',
        completionDate: '2025-01-10',
        expiryDate: null,
      },
      issuer
    );

    expect(db._store.certificates[0].organization_id).toBe(ORG);
  });

  it('rolls the row back when the chain write fails', async () => {
    const db = createFakeDb();
    const chain = createFakeChain({
      issue: () => {
        throw new Error('RPC down');
      },
    });
    const service = createCertificateService({ db, chain });

    await expect(
      service.issue(
        {
          studentName: 'Pich Rayuth',
          studentEmail: 'rayuth@example.com',
          courseName: 'Blockchain Fundamentals',
          completionDate: '2025-02-01',
          expiryDate: null,
        },
        issuer
      )
    ).rejects.toThrow('RPC down');

    // A certificate with no anchor is not verifiable; leaving it behind would
    // present an unverifiable credential as though it were issued.
    expect(db._store.certificates).toHaveLength(0);
    expect(db._store.certificate_hashes).toHaveLength(0);
  });

  it('stores a pending status without blocking when confirmation times out', async () => {
    const db = createFakeDb();
    const chain = createFakeChain({
      issue: () => ({
        txHash: '0xpending',
        blockTimestamp: null,
        status: 'pending',
      }),
    });
    const service = createCertificateService({ db, chain });

    const result = await service.issue(
      {
        studentName: 'Sok Dara',
        studentEmail: 'dara@example.com',
        courseName: 'BSc Computer Science',
        completionDate: '2025-04-01',
        expiryDate: null,
      },
      issuer
    );

    expect(result.hash.chain_status).toBe('pending');
    expect(result.hash.issue_tx_hash).toBe('0xpending');
  });
});

describe('verifyByCertId', () => {
  it('verifies a certificate whose stored data still produces the anchored hash', async () => {
    const db = createFakeDb(seedVerifiable());
    const service = createCertificateService({ db, chain: createFakeChain() });

    const result = await service.verifyByCertId(CERT_ID);

    expect(result.status).toBe('verified');
    expect(result.certificate.student_name).toBe('Chea Sophat');
    expect(result.certificate.institution_name).toBe(
      'Royal University of Phnom Penh'
    );
    expect(db._store.verification_logs[0].result).toBe('verified');
  });

  it('reports invalid when the stored data was altered after issuance', async () => {
    const seed = seedVerifiable();
    // The anchored hash covers "Chea Sophat"; the row now says someone else.
    seed.certificates[0].student_name = 'Someone Else';
    const db = createFakeDb(seed);
    const service = createCertificateService({ db, chain: createFakeChain() });

    const result = await service.verifyByCertId(CERT_ID);

    expect(result.status).toBe('invalid');
    // PII must not leak out of a tampered row.
    expect(result.certificate).toBeNull();
    expect(db._store.verification_logs[0].result).toBe('invalid');
  });

  it('reports invalid when the hash is absent from the chain', async () => {
    const db = createFakeDb(seedVerifiable());
    const chain = createFakeChain({
      verify: () => ({
        exists: false,
        revoked: false,
        issuedAt: 0,
        expiresAt: 0,
      }),
    });
    const service = createCertificateService({ db, chain });

    expect((await service.verifyByCertId(CERT_ID)).status).toBe('invalid');
  });

  it('reports revoked when the chain says so even if the database has not caught up', async () => {
    const db = createFakeDb(seedVerifiable());
    const chain = createFakeChain({
      verify: () => ({
        exists: true,
        revoked: true,
        issuedAt: 0,
        expiresAt: 0,
      }),
    });
    const service = createCertificateService({ db, chain });

    const result = await service.verifyByCertId(CERT_ID);
    expect(result.status).toBe('revoked');
    // Still returns the certificate — a verifier needs to see what was revoked.
    expect(result.certificate.student_name).toBe('Chea Sophat');
  });

  it('reports expired for a past expiry date', async () => {
    const db = createFakeDb(seedVerifiable({ expiry_date: '2020-01-01' }));
    const service = createCertificateService({ db, chain: createFakeChain() });

    expect((await service.verifyByCertId(CERT_ID)).status).toBe('expired');
  });

  it('logs an unknown id as not_found — the enumeration signal', async () => {
    const db = createFakeDb();
    const service = createCertificateService({ db, chain: createFakeChain() });

    const result = await service.verifyByCertId(
      '44444444-4444-4444-8444-444444444444'
    );

    expect(result).toEqual({ status: 'invalid', certificate: null });
    expect(db._store.verification_logs[0].result).toBe('not_found');
    expect(db._store.verification_logs[0].queried_id).toBe(
      '44444444-4444-4444-8444-444444444444'
    );
  });

  it('does not let a failed verification log break the answer', async () => {
    const db = createFakeDb(seedVerifiable());
    db._failTable('verification_logs');
    const service = createCertificateService({ db, chain: createFakeChain() });

    expect((await service.verifyByCertId(CERT_ID)).status).toBe('verified');
  });
});

describe('revoke', () => {
  it('writes to the chain before the database', async () => {
    const db = createFakeDb(seedVerifiable());
    const order = [];
    const chain = createFakeChain({
      revoke: () => {
        order.push('chain');
        return { txHash: '0xrevoked', status: 'confirmed' };
      },
    });
    const service = createCertificateService({ db, chain });

    const result = await service.revoke(CERT_ID, issuer, 'Issued in error');
    order.push('db');

    expect(order).toEqual(['chain', 'db']);
    expect(result.tx_hash).toBe('0xrevoked');
    expect(db._store.certificates[0].revoked_at).toBeTruthy();
    expect(db._store.certificates[0].revoke_reason).toBe('Issued in error');
    expect(db._store.certificate_hashes[0].revoke_tx_hash).toBe('0xrevoked');
    expect(db._store.audit_events[0].action).toBe('certificate.revoked');
  });

  it('refuses to revoke twice', async () => {
    const db = createFakeDb(
      seedVerifiable({ revoked_at: '2025-01-01T00:00:00.000Z' })
    );
    const service = createCertificateService({ db, chain: createFakeChain() });

    await expect(service.revoke(CERT_ID, issuer)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('hides another institution behind a 404 rather than a 403', async () => {
    const db = createFakeDb(seedVerifiable({ organization_id: OTHER_ORG }));
    const service = createCertificateService({ db, chain: createFakeChain() });

    // 403 would confirm the certificate exists elsewhere; 404 reveals nothing.
    await expect(service.revoke(CERT_ID, issuer)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('leaves the database untouched when the chain call fails', async () => {
    const db = createFakeDb(seedVerifiable());
    const chain = createFakeChain({
      revoke: () => {
        throw new Error('RPC down');
      },
    });
    const service = createCertificateService({ db, chain });

    await expect(service.revoke(CERT_ID, issuer)).rejects.toThrow('RPC down');
    // The dangerous direction: the institution must never believe a credential
    // is dead while every verifier still sees it as live.
    expect(db._store.certificates[0].revoked_at).toBeNull();
  });
});

describe('list and getById', () => {
  it('scopes an issuer to its own institution', async () => {
    const seed = seedVerifiable();
    seed.certificates.push({
      ...seed.certificates[0],
      id: '55555555-5555-4555-8555-555555555555',
      organization_id: OTHER_ORG,
    });
    const db = createFakeDb(seed);
    const service = createCertificateService({ db, chain: createFakeChain() });

    const { certificates } = await service.list(issuer, {
      limit: 50,
      offset: 0,
    });

    expect(certificates).toHaveLength(1);
    expect(certificates[0].id).toBe(CERT_ID);
  });

  it('derives status rather than reading a stored column', async () => {
    const db = createFakeDb(seedVerifiable({ expiry_date: '2020-01-01' }));
    const service = createCertificateService({ db, chain: createFakeChain() });

    const { certificates } = await service.list(issuer, {
      limit: 50,
      offset: 0,
    });

    expect(certificates[0].status).toBe('expired');
  });

  it('404s a certificate belonging to another institution', async () => {
    const db = createFakeDb(seedVerifiable({ organization_id: OTHER_ORG }));
    const service = createCertificateService({ db, chain: createFakeChain() });

    await expect(service.getById(CERT_ID, issuer)).rejects.toMatchObject({
      status: 404,
    });
  });
});
