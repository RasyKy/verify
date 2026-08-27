/**
 * Certificate service tests — the orchestration decisions.
 *
 * These cover the behaviours that are cheap to write down and expensive to
 * rediscover: the order chain and database writes happen in, and what
 * verification concludes when the stored data no longer matches its hash.
 *
 * Uses a hand-rolled Supabase query-builder fake rather than a mocking library,
 * because jest.mock() does not work under this project's native-ESM Jest.
 */
import { jest } from '@jest/globals';

import { createCertificateService } from '../src/services/certificate.js';
import { createStubService } from '../src/services/blockchain.js';
import { computeCertificateHash } from '../src/services/hash.js';

/**
 * Minimal stand-in for a supabase-js client.
 *
 * `handlers` maps "<table>.<op>" (or just "<table>") to the data a query should
 * resolve with. Every call is appended to `calls`, which is what the ordering
 * assertions read.
 */
function fakeDb(handlers = {}) {
  const calls = [];

  function from(table) {
    const ctx = { table, op: 'select', payload: null };

    const resolve = () => {
      const handler = handlers[`${table}.${ctx.op}`] ?? handlers[table];
      const data = typeof handler === 'function' ? handler(ctx) : handler;
      return { data: data ?? null, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (payload) => {
        ctx.op = 'insert';
        ctx.payload = payload;
        calls.push({ table, op: 'insert', payload });
        return builder;
      },
      update: (payload) => {
        ctx.op = 'update';
        ctx.payload = payload;
        calls.push({ table, op: 'update', payload });
        return builder;
      },
      eq: () => builder,
      is: () => builder,
      not: () => builder,
      lt: () => builder,
      or: () => builder,
      order: () => builder,
      range: () => builder,
      maybeSingle: async () => resolve(),
      single: async () => resolve(),
      // Makes a bare `await query` work, for inserts with no .select().
      then: (onOk, onErr) => Promise.resolve(resolve()).then(onOk, onErr),
    };
    return builder;
  }

  return { from, calls };
}

const ISSUER = {
  id: 'user-1',
  email: 'issuer@rppu.edu.kh',
  fullName: 'Chan Sothea',
  role: 'issuer',
  organizationId: 'org-rupp',
};

const INPUT = {
  studentName: 'Chea Sophat',
  studentEmail: 'sophat@example.com',
  courseName: 'Web Development Fundamentals',
  completionDate: '2026-02-03',
  expiryDate: null,
};

function makeService({ db, chain, audit = async () => {} } = {}) {
  return createCertificateService({
    adminClient: db,
    chain: chain ?? createStubService(),
    sendClaimEmail: async () => ({ sent: false }),
    audit,
  });
}

describe('issue()', () => {
  it('writes to the chain BEFORE the database', async () => {
    // If the database were written first and the chain call then failed, the row
    // would exist with no hash on chain — which verifies as `invalid`, i.e. a
    // genuine certificate reported as forged.
    const order = [];
    const db = fakeDb({
      organizations: { name: 'Royal Phnom Penh University' },
      courses: null,
      'courses.insert': { id: 'course-1', name: INPUT.courseName },
    });
    const originalFrom = db.from;
    db.from = (table) => {
      order.push(`db:${table}`);
      return originalFrom(table);
    };

    const chain = createStubService();
    const chainIssue = jest.fn(chain.issue);
    const service = makeService({
      db,
      chain: {
        ...chain,
        issue: async (...args) => {
          order.push('chain:issue');
          return chainIssue(...args);
        },
      },
    });

    await service.issue({ input: INPUT, user: ISSUER });

    expect(order[0]).toBe('chain:issue');
    expect(order.indexOf('chain:issue')).toBeLessThan(
      order.indexOf('db:certificates')
    );
  });

  it('stores nothing when the chain rejects the write', async () => {
    const db = fakeDb();
    const service = makeService({
      db,
      chain: {
        issue: async () => {
          const err = new Error('chain down');
          err.status = 503;
          throw err;
        },
      },
    });

    await expect(service.issue({ input: INPUT, user: ISSUER })).rejects.toThrow(
      'chain down'
    );
    expect(db.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('records the hash of the generated id, and both rows agree on it', async () => {
    const db = fakeDb({
      organizations: { name: 'Royal Phnom Penh University' },
      courses: null,
      'courses.insert': { id: 'course-1', name: INPUT.courseName },
    });
    const service = makeService({ db });

    const result = await service.issue({ input: INPUT, user: ISSUER });

    const expected = computeCertificateHash({
      certId: result.id,
      studentName: INPUT.studentName,
      courseName: INPUT.courseName,
      completionDate: INPUT.completionDate,
      expiryDate: null,
    });
    expect(result.hash).toBe(expected);

    const hashRow = db.calls.find((c) => c.table === 'certificate_hashes');
    expect(hashRow.payload.hash).toBe(expected);
    expect(hashRow.payload.is_current).toBe(true);
  });

  it('scopes the certificate to the caller organization, not to any input', async () => {
    const db = fakeDb({
      organizations: { name: 'Royal Phnom Penh University' },
      courses: null,
      'courses.insert': { id: 'course-1', name: INPUT.courseName },
    });
    const service = makeService({ db });

    await service.issue({ input: INPUT, user: ISSUER });

    const certRow = db.calls.find((c) => c.table === 'certificates');
    expect(certRow.payload.organization_id).toBe('org-rupp');
    expect(certRow.payload.issuer_id).toBe('user-1');
  });

  it('reports claim_email_sent: false without failing the issuance', async () => {
    const db = fakeDb({
      organizations: { name: 'Royal Phnom Penh University' },
      courses: null,
      'courses.insert': { id: 'course-1', name: INPUT.courseName },
    });
    const service = createCertificateService({
      adminClient: db,
      chain: createStubService(),
      sendClaimEmail: async () => ({ sent: false }),
      audit: async () => {},
    });

    const result = await service.issue({ input: INPUT, user: ISSUER });

    expect(result.id).toBeTruthy();
    expect(result.claim_email_sent).toBe(false);
  });

  it('stores only a digest of the claim token, never the token itself', async () => {
    const db = fakeDb({
      organizations: { name: 'Royal Phnom Penh University' },
      courses: null,
      'courses.insert': { id: 'course-1', name: INPUT.courseName },
    });
    const service = makeService({ db });

    await service.issue({ input: INPUT, user: ISSUER });

    const tokenRow = db.calls.find((c) => c.table === 'claim_tokens');
    // The column constraint is `^[0-9a-f]{64}$` — a sha256 digest.
    expect(tokenRow.payload.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenRow.payload.sent_to).toBe('sophat@example.com');
  });
});

describe('verify()', () => {
  const CERT_ID = '30000000-0000-4000-8000-000000000001';

  /** A stored row plus the chain state that a genuine issuance would produce. */
  async function genuine(overrides = {}) {
    const row = {
      id: CERT_ID,
      student_name: 'Chea Sophat',
      course_name: 'Web Development Fundamentals',
      completion_date: '2026-02-03',
      expiry_date: null,
      revoked_at: null,
      organizations: { name: 'Royal Phnom Penh University' },
      ...overrides,
    };
    const hash = computeCertificateHash({
      certId: row.id,
      studentName: row.student_name,
      courseName: row.course_name,
      completionDate: row.completion_date,
      expiryDate: row.expiry_date,
    });
    const chain = createStubService();
    await chain.issue(hash, 0);
    return { row, hash, chain };
  }

  it('reports a genuine certificate as verified', async () => {
    const { row, hash, chain } = await genuine();
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.status).toBe('verified');
    expect(result.certificate.studentName).toBe('Chea Sophat');
    expect(result.certificate.institutionName).toBe(
      'Royal Phnom Penh University'
    );
  });

  it('reads institution branding from organizations and the template from courses', async () => {
    const { row, hash, chain } = await genuine({
      organizations: {
        name: 'Royal Phnom Penh University',
        logo_url: 'https://x/logo.png',
        signature_url: 'https://x/sig.png',
        signatory_name: 'Dr. Sok Dara',
        signatory_title: 'Dean',
      },
      courses: { certificate_template: 'modern' },
    });
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.certificate.logoUrl).toBe('https://x/logo.png');
    expect(result.certificate.signatureUrl).toBe('https://x/sig.png');
    expect(result.certificate.signatoryName).toBe('Dr. Sok Dara');
    expect(result.certificate.signatoryTitle).toBe('Dean');
    expect(result.certificate.certificateTemplate).toBe('modern');
  });

  it('defaults to the classic template when the course has none linked', async () => {
    const { row, hash, chain } = await genuine({ courses: null });
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.certificate.certificateTemplate).toBe('classic');
  });

  it('detects tampering — an edited field no longer matches the stored hash', async () => {
    const { row, hash, chain } = await genuine();
    // Somebody edited the name directly in the database. The stored hash and the
    // chain still describe the original.
    const tampered = { ...row, student_name: 'Someone Else' };
    const db = fakeDb({
      certificates: tampered,
      certificate_hashes: { hash },
    });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.status).toBe('invalid');
    expect(result.certificate).toBeNull();
  });

  it('reports an unknown id as invalid, not as an error', async () => {
    const db = fakeDb({ certificates: null });
    const result = await makeService({ db }).verify({ certId: CERT_ID });

    expect(result).toEqual({ status: 'invalid', certificate: null });
  });

  it('reports a revoked certificate as revoked, with details intact', async () => {
    const { row, hash, chain } = await genuine();
    await chain.revoke(hash);
    const db = fakeDb({
      certificates: { ...row, revoked_at: '2026-08-01T00:00:00.000Z' },
      certificate_hashes: { hash },
    });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.status).toBe('revoked');
    expect(result.certificate).not.toBeNull();
  });

  it('reports an expired certificate as expired', async () => {
    const { row, hash, chain } = await genuine({ expiry_date: '2020-01-01' });
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.status).toBe('expired');
  });

  it('ignores is_hidden — hiding must not affect verifiability (FR-HOLD-07)', async () => {
    const { row, hash, chain } = await genuine({ is_hidden: true });
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });

    const result = await makeService({ db, chain }).verify({ certId: CERT_ID });

    expect(result.status).toBe('verified');
  });

  it('propagates a chain outage instead of concluding `invalid`', async () => {
    const { row, hash } = await genuine();
    const db = fakeDb({ certificates: row, certificate_hashes: { hash } });
    const chain = {
      verify: async () => {
        const err = new Error('rpc unreachable');
        err.status = 503;
        throw err;
      },
    };

    await expect(
      makeService({ db, chain }).verify({ certId: CERT_ID })
    ).rejects.toThrow('rpc unreachable');
  });
});
