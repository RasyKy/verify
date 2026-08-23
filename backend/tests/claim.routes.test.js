/**
 * Claim endpoint tests.
 *
 * Hermetic: a fake Supabase client, a fake `verifyBearerToken`, and a fake
 * `audit` are injected into the router factory, so these run with no network,
 * no database. Uses a hand-rolled query-builder fake rather than a mocking
 * library, because jest.mock() does not work under this project's native-ESM
 * Jest (see backend/README.md and tests/certificate.service.test.js).
 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createClaimRouter } from '../src/routes/claim.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { unauthorized } from '../src/lib/errors.js';

const CERT_ID = '30000000-0000-4000-8000-000000000001';
const USER_ID = 'user-holder-1';
const HOLDER_EMAIL = 'sophat@example.com';

const CERT = {
  id: CERT_ID,
  student_name: 'Chea Sophat',
  student_email: HOLDER_EMAIL,
  course_name: 'Web Development Fundamentals',
  holder_id: null,
  claim_state: 'unclaimed',
  organizations: { name: 'Royal Phnom Penh University' },
};

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

/**
 * `handlers` maps "<table>.<op>" (or just "<table>") to the data a query
 * should resolve with; `calls` records every insert/update for assertions.
 */
function fakeDb(handlers = {}) {
  const calls = [];

  function from(table) {
    const ctx = { table, op: 'select' };
    const resolve = () => {
      const handler = handlers[`${table}.${ctx.op}`] ?? handlers[table];
      const data = typeof handler === 'function' ? handler(ctx) : handler;
      return { data: data ?? null, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (payload) => {
        ctx.op = 'insert';
        calls.push({ table, op: 'insert', payload });
        return builder;
      },
      update: (payload) => {
        ctx.op = 'update';
        calls.push({ table, op: 'update', payload });
        return builder;
      },
      eq: () => builder,
      maybeSingle: async () => resolve(),
      then: (onOk, onErr) => Promise.resolve(resolve()).then(onOk, onErr),
    };
    return builder;
  }

  return { from, calls };
}

function makeApp({
  adminClient,
  verifyBearerToken = async () => ({ userId: USER_ID, email: HOLDER_EMAIL }),
  audit = async () => {},
} = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api', createClaimRouter({ adminClient, verifyBearerToken, audit }));
  app.use(errorHandler);
  return app;
}

describe('GET /api/claim/:token — public', () => {
  it('returns an invalid/blank preview for an unknown token', async () => {
    const db = fakeDb({ claim_tokens: null });
    const res = await request(makeApp({ adminClient: db })).get(
      '/api/claim/nonexistent-token'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: false,
      expired: false,
      used: false,
      superseded: false,
      studentName: '',
      courseName: '',
      institutionName: '',
      email: '',
    });
  });

  it('reports expired:true for a token past its expiry', async () => {
    const db = fakeDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: PAST,
        used_at: null,
        sent_to: HOLDER_EMAIL,
      },
      certificates: CERT,
    });
    const res = await request(makeApp({ adminClient: db })).get(
      '/api/claim/some-token'
    );

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.expired).toBe(true);
    expect(res.body.used).toBe(false);
    expect(res.body.studentName).toBe('Chea Sophat');
  });

  it('reports used:true, superseded:false for a genuinely claimed token', async () => {
    const db = fakeDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: FUTURE,
        used_at: new Date().toISOString(),
        sent_to: HOLDER_EMAIL,
      },
      certificates: { ...CERT, claim_state: 'claimed' },
    });
    const res = await request(makeApp({ adminClient: db })).get(
      '/api/claim/some-token'
    );

    expect(res.body.valid).toBe(false);
    expect(res.body.used).toBe(true);
    expect(res.body.superseded).toBe(false);
  });

  it('reports superseded:true when a resend retired the token', async () => {
    // resendClaim stamps used_at on the outstanding token before minting a
    // replacement, so this is what every pre-resend link looks like. The
    // certificate is still unclaimed, which is the only thing distinguishing
    // it from the case above.
    const db = fakeDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: FUTURE,
        used_at: new Date().toISOString(),
        sent_to: HOLDER_EMAIL,
      },
      certificates: { ...CERT, claim_state: 'unclaimed' },
    });
    const res = await request(makeApp({ adminClient: db })).get(
      '/api/claim/some-token'
    );

    expect(res.body.valid).toBe(false);
    expect(res.body.used).toBe(true);
    expect(res.body.superseded).toBe(true);
  });

  it('reports a full, valid preview for a live token', async () => {
    const db = fakeDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: FUTURE,
        used_at: null,
        sent_to: HOLDER_EMAIL,
      },
      certificates: CERT,
    });
    const res = await request(makeApp({ adminClient: db })).get(
      '/api/claim/some-token'
    );

    expect(res.body).toEqual({
      valid: true,
      expired: false,
      used: false,
      superseded: false,
      studentName: 'Chea Sophat',
      courseName: 'Web Development Fundamentals',
      institutionName: 'Royal Phnom Penh University',
      email: HOLDER_EMAIL,
    });
  });
});

describe('POST /api/claim/:token/confirm', () => {
  function liveTokenDb(overrides = {}) {
    return fakeDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: FUTURE,
        used_at: null,
        sent_to: HOLDER_EMAIL,
      },
      certificates: CERT,
      profiles: null,
      ...overrides,
    });
  }

  it('rejects a missing/invalid bearer token with 401', async () => {
    const db = liveTokenDb();
    const verifyBearerToken = async () => {
      throw unauthorized('Missing bearer token.');
    };
    const res = await request(
      makeApp({ adminClient: db, verifyBearerToken })
    ).post('/api/claim/some-token/confirm');

    expect(res.status).toBe(401);
  });

  it('404s for an unknown token', async () => {
    const db = fakeDb({ claim_tokens: null });
    const res = await request(makeApp({ adminClient: db })).post(
      '/api/claim/nonexistent-token/confirm'
    );

    expect(res.status).toBe(404);
  });

  it('409s for an already-used token', async () => {
    const db = liveTokenDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: FUTURE,
        used_at: new Date().toISOString(),
        sent_to: HOLDER_EMAIL,
      },
    });
    const res = await request(makeApp({ adminClient: db })).post(
      '/api/claim/some-token/confirm'
    );

    expect(res.status).toBe(409);
  });

  it('409s for an expired token', async () => {
    const db = liveTokenDb({
      claim_tokens: {
        id: 'tok-1',
        certificate_id: CERT_ID,
        expires_at: PAST,
        used_at: null,
        sent_to: HOLDER_EMAIL,
      },
    });
    const res = await request(makeApp({ adminClient: db })).post(
      '/api/claim/some-token/confirm'
    );

    expect(res.status).toBe(409);
  });

  it('403s when the verified JWT email does not match the certificate recipient', async () => {
    const db = liveTokenDb();
    const verifyBearerToken = async () => ({
      userId: USER_ID,
      email: 'someone-else@example.com',
    });
    const res = await request(
      makeApp({ adminClient: db, verifyBearerToken })
    ).post('/api/claim/some-token/confirm');

    expect(res.status).toBe(403);
    // No profile/certificate mutation should happen on a rejected email match.
    expect(db.calls).toHaveLength(0);
  });

  it('provisions a holder profile, links the cert, marks the token used, and audits — no existing profile', async () => {
    const db = liveTokenDb();
    const audit = jest.fn(async () => {});
    const res = await request(makeApp({ adminClient: db, audit })).post(
      '/api/claim/some-token/confirm'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const profileInsert = db.calls.find(
      (c) => c.table === 'profiles' && c.op === 'insert'
    );
    expect(profileInsert.payload).toMatchObject({
      id: USER_ID,
      email: HOLDER_EMAIL,
      role: 'holder',
    });

    const certUpdate = db.calls.find(
      (c) => c.table === 'certificates' && c.op === 'update'
    );
    expect(certUpdate.payload).toMatchObject({
      holder_id: USER_ID,
      claim_state: 'claimed',
    });

    const tokenUpdate = db.calls.find(
      (c) => c.table === 'claim_tokens' && c.op === 'update'
    );
    expect(tokenUpdate.payload.used_at).toBeTruthy();

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'certificate.claimed',
        metadata: { certificateId: CERT_ID },
      })
    );
  });

  it('links the cert without inserting a duplicate profile when a holder profile already exists', async () => {
    const db = liveTokenDb({ profiles: { id: USER_ID, role: 'holder' } });
    const res = await request(makeApp({ adminClient: db })).post(
      '/api/claim/some-token/confirm'
    );

    expect(res.status).toBe(200);
    expect(
      db.calls.find((c) => c.table === 'profiles' && c.op === 'insert')
    ).toBeUndefined();
    expect(
      db.calls.find((c) => c.table === 'certificates' && c.op === 'update')
    ).toBeDefined();
  });

  it('403s when the account already exists with a non-holder role', async () => {
    const db = liveTokenDb({ profiles: { id: USER_ID, role: 'issuer' } });
    const res = await request(makeApp({ adminClient: db })).post(
      '/api/claim/some-token/confirm'
    );

    expect(res.status).toBe(403);
    expect(
      db.calls.find((c) => c.table === 'certificates' && c.op === 'update')
    ).toBeUndefined();
  });
});
