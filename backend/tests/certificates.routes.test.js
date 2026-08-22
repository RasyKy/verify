/**
 * Certificate route tests.
 *
 * Hermetic: a fake service is injected into the router factory, so these pin
 * the HTTP contract — status codes, guards, and the public endpoint's promise
 * that it always answers rather than erroring — without touching Supabase or
 * Amoy.
 */
import express from 'express';
import request from 'supertest';

import { errorHandler } from '../src/middleware/errorHandler.js';
import { notFound } from '../src/lib/errors.js';
import { createCertificateRouter } from '../src/routes/certificates.js';

const CERT_ID = '33333333-3333-4333-8333-333333333333';

/** Builds an app around the certificate router with injected fakes. */
function makeApp({ service = {}, user } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/certificates',
    createCertificateRouter({
      service,
      requireAuth: (req, res, next) => {
        if (!user) {
          return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
        }
        req.user = user;
        next();
      },
    })
  );
  app.use(errorHandler);
  return app;
}

const issuer = {
  id: 'user-issuer',
  email: 'issuer@rupp.edu.kh',
  role: 'issuer',
  organizationId: '11111111-1111-4111-8111-111111111111',
};

const holder = { id: 'user-holder', role: 'holder', organizationId: null };

describe('GET /api/certificates/verify/:certId (public)', () => {
  it('needs no authentication', async () => {
    const service = {
      verifyByCertId: async () => ({ status: 'verified', certificate: {} }),
    };
    const res = await request(makeApp({ service })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
  });

  it('answers "invalid" for a malformed id instead of a validation error', async () => {
    // The public page lets a verifier paste anything into the search box. A 422
    // there renders as a broken page rather than an answer.
    const service = {
      verifyByCertId: async () => {
        throw new Error('should not be called');
      },
    };
    const res = await request(makeApp({ service })).get(
      '/api/certificates/verify/not-a-uuid'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'invalid', certificate: null });
  });

  it('is not shadowed by the :id detail route', async () => {
    // '/verify/x' must not be captured by '/:id' and rejected as a bad UUID.
    const service = {
      verifyByCertId: async (id) => ({
        status: 'verified',
        certificate: { id },
      }),
      getById: async () => {
        throw new Error('detail route should not handle /verify');
      },
    };
    const res = await request(makeApp({ service })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body.certificate.id).toBe(CERT_ID);
  });

  it('surfaces an unreachable chain as 503, never as an invalid certificate', async () => {
    const service = {
      verifyByCertId: async () => {
        const err = new Error('Blockchain network is unavailable');
        err.status = 503;
        err.code = 'UPSTREAM_UNAVAILABLE';
        err.expected = true;
        throw err;
      },
    };
    const res = await request(makeApp({ service })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    // Telling an employer a genuine credential is fake is far worse than
    // admitting the service is briefly down.
    expect(res.status).toBe(503);
    expect(res.body.status).not.toBe('invalid');
  });
});

describe('POST /api/certificates', () => {
  it('issues and returns 201', async () => {
    const service = {
      issue: async (input, actor) => ({ id: CERT_ID, ...input, actor }),
    };
    const res = await request(makeApp({ service, user: issuer }))
      .post('/api/certificates')
      .send({
        studentName: 'Sophéa Kim',
        studentEmail: 'sophea@example.com',
        courseName: 'Advanced Web Development',
        completionDate: '2025-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(CERT_ID);
  });

  it('rejects an anonymous caller', async () => {
    const res = await request(makeApp({ service: {} }))
      .post('/api/certificates')
      .send({});

    expect(res.status).toBe(401);
  });

  it('rejects a holder', async () => {
    const res = await request(makeApp({ service: {}, user: holder }))
      .post('/api/certificates')
      .send({
        studentName: 'Someone',
        studentEmail: 'a@example.com',
        courseName: 'Course',
        completionDate: '2025-01-01',
      });

    expect(res.status).toBe(403);
  });

  it('rejects an issuer with no institution', async () => {
    const res = await request(
      makeApp({ service: {}, user: { ...issuer, organizationId: null } })
    )
      .post('/api/certificates')
      .send({
        studentName: 'Someone',
        studentEmail: 'a@example.com',
        courseName: 'Course',
        completionDate: '2025-01-01',
      });

    expect(res.status).toBe(403);
  });

  it('validates before reaching the service', async () => {
    const service = {
      issue: async () => {
        throw new Error('should not be called');
      },
    };
    const res = await request(makeApp({ service, user: issuer }))
      .post('/api/certificates')
      .send({
        studentName: 'A', // below the 2-character minimum
        studentEmail: 'not-an-email',
        courseName: '',
        completionDate: '2999-01-01', // future
      });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(['studentName', 'studentEmail', 'completionDate'])
    );
  });

  it('discards a client-supplied institution', async () => {
    let received;
    const service = {
      issue: async (input) => {
        received = input;
        return { id: CERT_ID };
      },
    };
    await request(makeApp({ service, user: issuer }))
      .post('/api/certificates')
      .send({
        studentName: 'Sok Dara',
        studentEmail: 'dara@example.com',
        courseName: 'BSc Computer Science',
        completionDate: '2025-01-05',
        institution: 'Totally Legit University',
      });

    // Accepting it would let an issuer attribute a certificate to any
    // institution they cared to type.
    expect(received).not.toHaveProperty('institution');
  });
});

describe('GET /api/certificates', () => {
  it('passes coerced query defaults through to the service', async () => {
    let received;
    const service = {
      list: async (_actor, filters) => {
        received = filters;
        return { total: 0, certificates: [] };
      },
    };
    const res = await request(makeApp({ service, user: issuer })).get(
      '/api/certificates'
    );

    expect(res.status).toBe(200);
    expect(received).toMatchObject({ limit: 200, offset: 0 });
  });

  it('rejects an out-of-range limit', async () => {
    const res = await request(makeApp({ service: {}, user: issuer })).get(
      '/api/certificates?limit=9999'
    );

    expect(res.status).toBe(422);
  });
});

describe('GET /api/certificates/:id', () => {
  it('rejects a non-uuid id', async () => {
    const res = await request(makeApp({ service: {}, user: issuer })).get(
      '/api/certificates/1'
    );

    // A probe for sequential ids is rejected before it reaches a query (T-05).
    expect(res.status).toBe(422);
  });

  it('forwards the service 404', async () => {
    const service = {
      getById: async () => {
        throw notFound('Certificate not found.');
      },
    };
    const res = await request(makeApp({ service, user: issuer })).get(
      `/api/certificates/${CERT_ID}`
    );

    expect(res.status).toBe(404);
  });
});

describe('POST /api/certificates/:id/revoke', () => {
  it('revokes and returns the transaction hash', async () => {
    const service = {
      revoke: async (id, _actor, reason) => ({
        id,
        status: 'revoked',
        tx_hash: '0xrevoked',
        reason,
      }),
    };
    const res = await request(makeApp({ service, user: issuer }))
      .post(`/api/certificates/${CERT_ID}/revoke`)
      .send({ reason: 'Issued in error' });

    expect(res.status).toBe(200);
    expect(res.body.tx_hash).toBe('0xrevoked');
    expect(res.body.reason).toBe('Issued in error');
  });

  it('accepts an empty body — the modal sends none', async () => {
    const service = {
      revoke: async (id) => ({ id, status: 'revoked', tx_hash: '0xr' }),
    };
    const res = await request(makeApp({ service, user: issuer }))
      .post(`/api/certificates/${CERT_ID}/revoke`)
      .send({});

    expect(res.status).toBe(200);
  });

  it('rejects an unknown field rather than silently ignoring it', async () => {
    const res = await request(makeApp({ service: {}, user: issuer }))
      .post(`/api/certificates/${CERT_ID}/revoke`)
      .send({ reason: 'ok', revokedBy: 'someone-else' });

    expect(res.status).toBe(422);
  });

  it('rejects a holder', async () => {
    const res = await request(makeApp({ service: {}, user: holder }))
      .post(`/api/certificates/${CERT_ID}/revoke`)
      .send({});

    expect(res.status).toBe(403);
  });
});
