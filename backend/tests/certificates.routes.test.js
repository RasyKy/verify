/**
 * Certificate endpoint tests.
 *
 * Hermetic: a fake certificate service is injected into the router factory, so
 * these run with no network, no database and no chain. They pin the parts of the
 * contract that are expensive to get wrong later — the rules that decide whether
 * a genuine certificate is reported as genuine.
 */
import express from 'express';
import request from 'supertest';

import { createCertificatesRouter } from '../src/routes/certificates.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { upstreamUnavailable } from '../src/lib/errors.js';

const ISSUER = {
  id: 'user-1',
  email: 'issuer@rppu.edu.kh',
  role: 'issuer',
  organizationId: 'org-rupp',
};

const CERT_ID = '30000000-0000-4000-8000-000000000001';

/** Builds an app around the certificates router with injected fakes. */
function makeApp({ service = {}, user = ISSUER } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createCertificatesRouter({
      service: { logVerification: async () => {}, ...service },
      requireAuth: (req, res, next) => {
        if (!user) {
          return res
            .status(401)
            .json({ error: { code: 'UNAUTHENTICATED' }, message: 'no token' });
        }
        req.user = user;
        next();
      },
    })
  );
  app.use(errorHandler);
  return app;
}

describe('GET /api/certificates/verify/:certId — public', () => {
  it('reports a genuine certificate as verified, in camelCase', async () => {
    const service = {
      verify: async () => ({
        status: 'verified',
        certificate: {
          studentName: 'Chea Sophat',
          courseName: 'Web Development Fundamentals',
          institutionName: 'Royal Phnom Penh University',
          completionDate: '2026-02-03',
          expiryDate: null,
          certId: CERT_ID,
          issuedAtBlockchainTimestamp: '2026-02-03T09:15:22.000Z',
        },
      }),
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');
    // ResultCard.vue destructures these exact names.
    expect(res.body.certificate.studentName).toBe('Chea Sophat');
    expect(res.body.certificate.institutionName).toBe(
      'Royal Phnom Penh University'
    );
  });

  it('is public — no bearer token required', async () => {
    const service = {
      verify: async () => ({ status: 'invalid', certificate: null }),
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );
    expect(res.status).toBe(200);
  });

  it('answers `invalid` for a malformed ID rather than 422 or 500', async () => {
    // The verify page lets a verifier paste free text into the search box, so
    // garbage is a normal user action, not a client error.
    const res = await request(makeApp({ user: null })).get(
      '/api/certificates/verify/definitely-not-a-uuid'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'invalid', certificate: null });
  });

  it('withholds details when invalid, so a verifier cannot probe for real IDs', async () => {
    const service = {
      verify: async () => ({ status: 'invalid', certificate: null }),
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.body.certificate).toBeNull();
  });

  it('surfaces a chain outage as 503 — NEVER as `invalid`', async () => {
    // The single most important behaviour in this file. Reporting a genuine
    // certificate as fake because a node provider blipped is the worst output
    // this system can produce (docs/api-schema.md:38-41).
    const service = {
      verify: async () => {
        throw upstreamUnavailable('Blockchain network');
      },
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(res.body.status).not.toBe('invalid');
  });

  it('still returns details for a revoked certificate', async () => {
    // ResultCard.vue renders the certificate body for revoked and expired.
    const service = {
      verify: async () => ({
        status: 'revoked',
        certificate: { certId: CERT_ID, studentName: 'Chea Sophat' },
      }),
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.body.status).toBe('revoked');
    expect(res.body.certificate).not.toBeNull();
  });
});

describe('GET /api/certificates — issuer list', () => {
  it('scopes the query to the caller organization', async () => {
    let received;
    const service = {
      list: async (args) => {
        received = args;
        return [];
      },
    };
    await request(makeApp({ service })).get('/api/certificates');

    // An ISTAD issuer must never be able to widen this to RUPP's rows.
    expect(received.organizationId).toBe('org-rupp');
  });

  it('returns snake_case with a derived status, as the table destructures', async () => {
    const service = {
      list: async () => [
        {
          id: CERT_ID,
          student_name: 'Chea Sophat',
          student_email: 'sophat@example.com',
          course_name: 'Web Development Fundamentals',
          completion_date: '2026-02-03',
          expiry_date: null,
          status: 'valid',
          institution_name: 'Royal Phnom Penh University',
          issued_at: '2026-02-03T09:15:00.000Z',
          revoked_at: null,
        },
      ],
    };
    const res = await request(makeApp({ service })).get('/api/certificates');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      student_name: 'Chea Sophat',
      completion_date: '2026-02-03',
      status: 'valid',
      institution_name: 'Royal Phnom Penh University',
    });
  });

  it('rejects a holder', async () => {
    const holder = { ...ISSUER, role: 'holder' };
    const res = await request(makeApp({ user: holder })).get('/api/certificates');
    expect(res.status).toBe(403);
  });

  it('rejects an issuer with no organization', async () => {
    const orphan = { ...ISSUER, organizationId: null };
    const res = await request(makeApp({ user: orphan })).get('/api/certificates');
    expect(res.status).toBe(403);
  });

  it('coerces and defaults pagination', async () => {
    let received;
    const service = {
      list: async (args) => {
        received = args;
        return [];
      },
    };
    await request(makeApp({ service })).get('/api/certificates?limit=10&offset=5');

    expect(received.limit).toBe(10);
    expect(received.offset).toBe(5);
  });
});

describe('POST /api/certificates — issuance', () => {
  const body = {
    studentName: 'Chea Sophat',
    studentEmail: 'sophat@example.com',
    courseName: 'Web Development Fundamentals',
    completionDate: '2026-02-03',
    expiryDate: null,
    institution: 'Anything At All University',
  };

  it('issues and returns 201 with the hash and chain status', async () => {
    const service = {
      issue: async () => ({
        id: CERT_ID,
        status: 'unclaimed',
        hash: `0x${'a'.repeat(64)}`,
        issue_tx_hash: '0xtx',
        chain_status: 'confirmed',
        claim_email_sent: false,
      }),
    };
    const res = await request(makeApp({ service }))
      .post('/api/certificates')
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(res.body.chain_status).toBe('confirmed');
  });

  it('discards `institution` and takes the org from the caller', async () => {
    // The form pre-fills institution from user-editable user_metadata; honouring
    // it would let an issuer attribute a certificate to any institution.
    let received;
    const service = {
      issue: async (args) => {
        received = args;
        return { id: CERT_ID };
      },
    };
    await request(makeApp({ service })).post('/api/certificates').send(body);

    expect(received.input.institution).toBeUndefined();
    expect(received.user.organizationId).toBe('org-rupp');
  });

  it('rejects a future completion date', async () => {
    const future = new Date(Date.now() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const res = await request(makeApp())
      .post('/api/certificates')
      .send({ ...body, completionDate: future });

    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors.completionDate).toBeDefined();
  });

  it('rejects an expiry that precedes completion', async () => {
    const res = await request(makeApp())
      .post('/api/certificates')
      .send({ ...body, expiryDate: '2020-01-01' });

    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors.expiryDate).toBeDefined();
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const res = await request(makeApp())
      .post('/api/certificates')
      .send({ ...body, organizationId: 'org-someone-else' });

    expect(res.status).toBe(422);
  });

  it('duplicates the error message at the top level for the frontend toast', async () => {
    const res = await request(makeApp())
      .post('/api/certificates')
      .send({ ...body, studentEmail: 'not-an-email' });

    // Components read err?.data?.message.
    expect(res.body.message).toBeTruthy();
    expect(res.body.message).toBe(res.body.error.message);
  });
});

describe('POST /api/certificates/:id/revoke', () => {
  it('revokes and returns the transaction hash', async () => {
    const service = {
      revoke: async () => ({
        id: CERT_ID,
        status: 'revoked',
        revoked_at: '2026-08-17T10:00:00.000Z',
        revoke_tx_hash: '0xrevoke',
      }),
    };
    const res = await request(makeApp({ service })).post(
      `/api/certificates/${CERT_ID}/revoke`
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('revoked');
  });

  it('accepts an empty body — the modal sends none', async () => {
    let received;
    const service = {
      revoke: async (args) => {
        received = args;
        return { id: CERT_ID };
      },
    };
    const res = await request(makeApp({ service })).post(
      `/api/certificates/${CERT_ID}/revoke`
    );

    expect(res.status).toBe(200);
    expect(received.reason).toBeNull();
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(makeApp()).post('/api/certificates/abc/revoke');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/certificates/:id/qr — public', () => {
  it('serves a PNG without authentication', async () => {
    const res = await request(makeApp({ user: null })).get(
      `/api/certificates/${CERT_ID}/qr`
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('serves SVG on request', async () => {
    const res = await request(makeApp({ user: null })).get(
      `/api/certificates/${CERT_ID}/qr?format=svg`
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg/);
  });

  it('caps the rendered size — public, unauthenticated and CPU-bound', async () => {
    const res = await request(makeApp({ user: null })).get(
      `/api/certificates/${CERT_ID}/qr?size=100000`
    );
    expect(res.status).toBe(422);
  });
});

describe('route ordering', () => {
  it('does not treat "verify" as a certificate id', async () => {
    // `/certificates/:id` is registered after `/certificates/verify/:certId`;
    // swapping them makes every verification a 422 on a malformed UUID.
    const service = {
      verify: async () => ({ status: 'invalid', certificate: null }),
      getById: async () => {
        throw new Error('getById must not be reached for a verify URL');
      },
    };
    const res = await request(makeApp({ service, user: null })).get(
      `/api/certificates/verify/${CERT_ID}`
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});
