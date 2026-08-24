/**
 * Holder dashboard endpoint tests (FR-HOLD-01 through 06).
 *
 * Hermetic — a fake Supabase client is injected into the router factory, same
 * pattern as certificates.routes.test.js. The fake actually applies .eq()
 * filters against seeded row arrays (one per table), so scoping is asserted
 * through real query semantics rather than a mocked call.
 */
import express from 'express';
import request from 'supertest';

import { createHolderRouter } from '../src/routes/holder.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const HOLDER = {
  id: 'holder-1',
  email: 'sophat@example.com',
  role: 'holder',
  organizationId: null,
};

/**
 * Applies .eq()/.order()/.update()/.maybeSingle() against seeded row arrays,
 * keyed by table. `.update(patch)` merges `patch` into every row still
 * matching the accumulated .eq() filters at the point .update() is called,
 * mirroring how a real UPDATE...WHERE only touches already-filtered rows.
 */
function fakeDb(tables = {}) {
  function from(table) {
    const rows = tables[table];
    if (!rows) {
      throw new Error(`fakeDb: unexpected table "${table}"`);
    }
    const filters = [];
    let pendingUpdate = null;
    const matches = (row) =>
      filters.every(([field, value]) => row[field] === value);
    const applyUpdate = () => {
      if (!pendingUpdate) return;
      for (const row of rows) {
        if (matches(row)) Object.assign(row, pendingUpdate);
      }
    };
    const builder = {
      select: () => builder,
      eq: (field, value) => {
        filters.push([field, value]);
        return builder;
      },
      order: () => builder,
      update: (patch) => {
        pendingUpdate = patch;
        return builder;
      },
      maybeSingle: () => {
        applyUpdate();
        const found = rows.find(matches) ?? null;
        return Promise.resolve({ data: found, error: null });
      },
      then: (onOk, onErr) => {
        applyUpdate();
        const filtered = rows.filter(matches);
        return Promise.resolve({ data: filtered, error: null }).then(
          onOk,
          onErr
        );
      },
    };
    return builder;
  }
  return { from };
}

function makeApp({ certificates = [], profiles = [], user = HOLDER } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createHolderRouter({
      adminClient: fakeDb({ certificates, profiles }),
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

const BASE_ROW = {
  course_name: 'Web Development Fundamentals',
  completion_date: '2026-02-03',
  expiry_date: null,
  claim_state: 'claimed',
  revoked_at: null,
  is_hidden: false,
  created_at: '2026-02-03T09:15:00.000Z',
  organizations: { name: 'Royal Phnom Penh University' },
  certificate_hashes: [
    { chain_issued_at: '2026-02-03T09:15:22.000Z', is_current: true },
  ],
};

describe('GET /api/holder/certificates', () => {
  it('returns only certificates belonging to the caller', async () => {
    const rows = [
      { ...BASE_ROW, id: 'cert-mine', holder_id: 'holder-1' },
      { ...BASE_ROW, id: 'cert-not-mine', holder_id: 'holder-2' },
    ];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('cert-mine');
  });

  it('rejects a non-holder role', async () => {
    const issuer = { ...HOLDER, role: 'issuer' };
    const res = await request(makeApp({ user: issuer })).get(
      '/api/holder/certificates'
    );
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp({ user: null })).get(
      '/api/holder/certificates'
    );
    expect(res.status).toBe(401);
  });

  it('derives status: revoked outranks everything else', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-revoked',
        holder_id: 'holder-1',
        revoked_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );
    expect(res.body[0].status).toBe('revoked');
  });

  it('derives status: expired when past expiry_date', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-expired',
        holder_id: 'holder-1',
        expiry_date: '2020-01-01',
      },
    ];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );
    expect(res.body[0].status).toBe('expired');
  });

  it('reads institution_name from the organizations join', async () => {
    const rows = [{ ...BASE_ROW, id: 'cert-1', holder_id: 'holder-1' }];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );
    expect(res.body[0].institution_name).toBe('Royal Phnom Penh University');
  });

  it('picks the is_current hash row for issuedAtBlockchainTimestamp', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-reissued',
        holder_id: 'holder-1',
        certificate_hashes: [
          { chain_issued_at: '2025-01-01T00:00:00.000Z', is_current: false },
          { chain_issued_at: '2026-02-03T09:15:22.000Z', is_current: true },
        ],
      },
    ];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );
    expect(res.body[0].issuedAtBlockchainTimestamp).toBe(
      '2026-02-03T09:15:22.000Z'
    );
  });

  it('returns [] rather than an error when the holder has no certificates', async () => {
    const res = await request(makeApp({ certificates: [] })).get(
      '/api/holder/certificates'
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('passes is_hidden through as the stored value, unmodified', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-hidden',
        holder_id: 'holder-1',
        is_hidden: true,
      },
    ];
    const res = await request(makeApp({ certificates: rows })).get(
      '/api/holder/certificates'
    );
    expect(res.body[0].is_hidden).toBe(true);
  });
});

describe('PATCH /api/holder/certificates/:id', () => {
  const CERT_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_CERT_ID = '22222222-2222-4222-8222-222222222222';
  const MISSING_CERT_ID = '99999999-9999-4999-8999-999999999999';
  const OWNED = { ...BASE_ROW, id: CERT_ID, holder_id: 'holder-1' };

  it('hides an owned certificate and returns the updated value', async () => {
    const res = await request(makeApp({ certificates: [{ ...OWNED }] }))
      .patch(`/api/holder/certificates/${CERT_ID}`)
      .send({ is_hidden: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: CERT_ID, is_hidden: true });
  });

  it('unhides an owned certificate', async () => {
    const res = await request(
      makeApp({ certificates: [{ ...OWNED, is_hidden: true }] })
    )
      .patch(`/api/holder/certificates/${CERT_ID}`)
      .send({ is_hidden: false });

    expect(res.status).toBe(200);
    expect(res.body.is_hidden).toBe(false);
  });

  it('404s on a certificate owned by someone else, same as a nonexistent id', async () => {
    const notMine = { ...BASE_ROW, id: OTHER_CERT_ID, holder_id: 'holder-2' };
    const res = await request(makeApp({ certificates: [notMine] }))
      .patch(`/api/holder/certificates/${OTHER_CERT_ID}`)
      .send({ is_hidden: true });

    expect(res.status).toBe(404);
  });

  it('404s on a nonexistent certificate id', async () => {
    const res = await request(makeApp({ certificates: [] }))
      .patch(`/api/holder/certificates/${MISSING_CERT_ID}`)
      .send({ is_hidden: true });

    expect(res.status).toBe(404);
  });

  it('rejects a non-boolean is_hidden', async () => {
    const res = await request(makeApp({ certificates: [{ ...OWNED }] }))
      .patch(`/api/holder/certificates/${CERT_ID}`)
      .send({ is_hidden: 'yes' });

    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp({ certificates: [OWNED], user: null }))
      .patch(`/api/holder/certificates/${CERT_ID}`)
      .send({ is_hidden: true });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/holder/profile', () => {
  it("returns the caller's current profile_is_public value", async () => {
    const res = await request(
      makeApp({ profiles: [{ id: 'holder-1', profile_is_public: false }] })
    ).get('/api/holder/profile');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ profile_is_public: false });
  });

  it('requires authentication', async () => {
    const res = await request(makeApp({ user: null })).get(
      '/api/holder/profile'
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/holder/profile', () => {
  it('updates and returns the new profile_is_public value', async () => {
    const res = await request(
      makeApp({ profiles: [{ id: 'holder-1', profile_is_public: true }] })
    )
      .patch('/api/holder/profile')
      .send({ profile_is_public: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ profile_is_public: false });
  });

  it('rejects a non-boolean profile_is_public', async () => {
    const res = await request(
      makeApp({ profiles: [{ id: 'holder-1', profile_is_public: true }] })
    )
      .patch('/api/holder/profile')
      .send({ profile_is_public: 'nope' });

    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp({ user: null }))
      .patch('/api/holder/profile')
      .send({ profile_is_public: false });

    expect(res.status).toBe(401);
  });
});

/**
 * The public profile — the surface `is_hidden` and `profile_is_public` exist to
 * control. Before this endpoint both flags were write-only, so these are the
 * tests that make the toggles mean something.
 *
 * Note `user: null` throughout: makeApp's requireAuth stub answers 401 when
 * there is no user, so every 200 below also proves the route never touched it.
 */
describe('GET /api/profiles/:holderId', () => {
  const HOLDER_ID = '33333333-3333-4333-8333-333333333333';
  const MISSING_ID = '44444444-4444-4444-8444-444444444444';

  const PUBLIC_HOLDER = {
    id: HOLDER_ID,
    full_name: 'Sophat Chan',
    role: 'holder',
    status: 'active',
    profile_is_public: true,
  };

  /** Anonymous request — no bearer token anywhere in the chain. */
  const getProfile = (app, id = HOLDER_ID) =>
    request(app).get(`/api/profiles/${id}`);

  const publicApp = (certificates, profileOverrides = {}) =>
    makeApp({
      certificates,
      profiles: [{ ...PUBLIC_HOLDER, ...profileOverrides }],
      user: null,
    });

  it('serves an anonymous caller with no token at all', async () => {
    const res = await getProfile(publicApp([]));
    expect(res.status).toBe(200);
  });

  it('omits hidden certificates and returns the visible ones', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-visible',
        holder_id: HOLDER_ID,
        student_name: 'Sophat Chan',
        is_hidden: false,
      },
      {
        ...BASE_ROW,
        id: 'cert-hidden',
        holder_id: HOLDER_ID,
        student_name: 'Sophat Chan',
        is_hidden: true,
      },
    ];
    const res = await getProfile(publicApp(rows));

    expect(res.status).toBe(200);
    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.certificates[0].id).toBe('cert-visible');
  });

  it("omits another holder's certificates", async () => {
    const rows = [
      { ...BASE_ROW, id: 'mine', holder_id: HOLDER_ID, is_hidden: false },
      { ...BASE_ROW, id: 'theirs', holder_id: 'holder-2', is_hidden: false },
    ];
    const res = await getProfile(publicApp(rows));
    expect(res.body.certificates.map((c) => c.id)).toEqual(['mine']);
  });

  it('never leaks is_hidden or student_name on a certificate', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-1',
        holder_id: HOLDER_ID,
        student_name: 'Sophat Chan',
        is_hidden: false,
      },
    ];
    const res = await getProfile(publicApp(rows));

    expect(res.body.certificates[0]).not.toHaveProperty('is_hidden');
    expect(res.body.certificates[0]).not.toHaveProperty('student_name');
    expect(res.body.certificates[0]).not.toHaveProperty('student_email');
  });

  it('404s when the profile is private', async () => {
    const rows = [
      { ...BASE_ROW, id: 'cert-1', holder_id: HOLDER_ID, is_hidden: false },
    ];
    const res = await getProfile(publicApp(rows, { profile_is_public: false }));
    expect(res.status).toBe(404);
  });

  it('404s for a deactivated holder', async () => {
    const res = await getProfile(publicApp([], { status: 'suspended' }));
    expect(res.status).toBe(404);
  });

  it('404s for a non-holder account', async () => {
    const res = await getProfile(publicApp([], { role: 'issuer' }));
    expect(res.status).toBe(404);
  });

  it('404s for a nonexistent profile', async () => {
    const res = await getProfile(publicApp([]), MISSING_ID);
    expect(res.status).toBe(404);
  });

  /**
   * The anti-enumeration property, asserted as one test because it is the
   * whole point: a private profile must be byte-identical to a missing one, or
   * the response confirms the account exists and has chosen to hide.
   */
  it('makes a private profile indistinguishable from a missing one', async () => {
    const privateRes = await getProfile(
      publicApp([], { profile_is_public: false })
    );
    const missingRes = await getProfile(publicApp([]), MISSING_ID);

    expect(privateRes.status).toBe(missingRes.status);
    expect(privateRes.body).toEqual(missingRes.body);
  });

  it('rejects a holderId that is not a UUID', async () => {
    const res = await getProfile(publicApp([]), 'not-a-uuid');
    expect(res.status).toBe(422);
  });

  it('returns 200 with an empty list when every certificate is hidden', async () => {
    const rows = [
      { ...BASE_ROW, id: 'cert-1', holder_id: HOLDER_ID, is_hidden: true },
    ];
    const res = await getProfile(publicApp(rows));

    expect(res.status).toBe(200);
    expect(res.body.certificates).toEqual([]);
  });

  it('shows revoked certificates with their status rather than dropping them', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-revoked',
        holder_id: HOLDER_ID,
        is_hidden: false,
        revoked_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const res = await getProfile(publicApp(rows));

    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.certificates[0].status).toBe('revoked');
  });

  it('uses full_name as the display name when set', async () => {
    const res = await getProfile(publicApp([]));
    expect(res.body.holder.display_name).toBe('Sophat Chan');
  });

  it('falls back to student_name, never the email local part', async () => {
    const rows = [
      {
        ...BASE_ROW,
        id: 'cert-1',
        holder_id: HOLDER_ID,
        student_name: 'Sophat Chan',
        student_email: 'sophat.private@example.com',
        is_hidden: false,
      },
    ];
    const res = await getProfile(publicApp(rows, { full_name: null }));

    expect(res.body.holder.display_name).toBe('Sophat Chan');
    expect(JSON.stringify(res.body)).not.toContain('sophat.private');
  });

  it('falls back to a neutral label when there is no name to show', async () => {
    const res = await getProfile(publicApp([], { full_name: null }));
    expect(res.body.holder.display_name).toBe('Certificate holder');
  });
});
