/**
 * Course endpoint tests.
 *
 * Hermetic — a fake Supabase client is injected into the router factory, same
 * pattern as holder.routes.test.js.
 */
import express from 'express';
import request from 'supertest';

import { createCoursesRouter } from '../src/routes/courses.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const ISSUER = {
  id: 'issuer-1',
  email: 'issuer.rupp@example.com',
  role: 'issuer',
  organizationId: 'org-1',
};

const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_COURSE_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_COURSE_ID = '99999999-9999-4999-8999-999999999999';

/** Same fakeDb shape used by holder.routes.test.js, with insert()/update() added. */
function fakeDb(tables = {}) {
  function from(table) {
    const rows = tables[table];
    if (!rows) {
      throw new Error(`fakeDb: unexpected table "${table}"`);
    }
    const filters = [];
    let pendingInsert = null;
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
      insert: (patch) => {
        pendingInsert = { id: `new-${rows.length + 1}`, ...patch };
        rows.push(pendingInsert);
        return builder;
      },
      update: (patch) => {
        pendingUpdate = patch;
        return builder;
      },
      maybeSingle: () => {
        applyUpdate();
        if (pendingInsert) {
          return Promise.resolve({ data: pendingInsert, error: null });
        }
        const found = rows.find(matches) ?? null;
        return Promise.resolve({ data: found, error: null });
      },
      single: () => builder.maybeSingle(),
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

function makeApp({ courses = [], user = ISSUER } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createCoursesRouter({
      adminClient: fakeDb({ courses }),
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

const COURSE = {
  id: COURSE_ID,
  name: 'Blockchain for Developers',
  organization_id: 'org-1',
  certificate_template: 'classic',
};

describe('GET /api/courses', () => {
  it("returns a bare string array of the organization's course names", async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] })).get(
      '/api/courses'
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Blockchain for Developers']);
  });

  it('requires an issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    ).get('/api/courses');
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: null })
    ).get('/api/courses');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/courses', () => {
  it('creates a new course', async () => {
    const res = await request(makeApp({ courses: [] }))
      .post('/api/courses')
      .send({ name: 'New Course' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'New Course' });
  });

  it('is idempotent on (organization, name) — returns the existing course', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post('/api/courses')
      .send({ name: 'Blockchain for Developers' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: COURSE_ID,
      name: 'Blockchain for Developers',
    });
  });

  it('creates a new course with the given certificate template', async () => {
    const res = await request(makeApp({ courses: [] }))
      .post('/api/courses')
      .send({ name: 'New Course', certificateTemplate: 'editorial' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'New Course',
      certificateTemplate: 'editorial',
    });
  });

  it("does not let a re-submission overwrite an existing course's template", async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE, certificate_template: 'modern' }] })
    )
      .post('/api/courses')
      .send({
        name: 'Blockchain for Developers',
        certificateTemplate: 'editorial',
      });

    expect(res.status).toBe(201);
    expect(res.body.certificateTemplate).toBe('modern');
  });

  it('rejects an unknown certificateTemplate value', async () => {
    const res = await request(makeApp({ courses: [] }))
      .post('/api/courses')
      .send({ name: 'New Course', certificateTemplate: 'nonexistent' });
    expect(res.status).toBe(422);
  });

  it('requires an issuer role', async () => {
    const res = await request(
      makeApp({ courses: [], user: { ...ISSUER, role: 'holder' } })
    )
      .post('/api/courses')
      .send({ name: 'New Course' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/courses/full', () => {
  it('returns certificateTemplate alongside id and name', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE, certificate_template: 'modern' }] })
    ).get('/api/courses/full');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: COURSE_ID,
        name: 'Blockchain for Developers',
        certificateTemplate: 'modern',
      },
    ]);
  });

  it('requires an issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    ).get('/api/courses/full');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/courses/:id/template', () => {
  it("updates the course's certificate template", async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .patch(`/api/courses/${COURSE_ID}/template`)
      .send({ certificateTemplate: 'editorial' });

    expect(res.status).toBe(200);
    expect(res.body.certificateTemplate).toBe('editorial');
  });

  it('rejects an unknown template value', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .patch(`/api/courses/${COURSE_ID}/template`)
      .send({ certificateTemplate: 'nonexistent' });
    expect(res.status).toBe(422);
  });

  it('404s on a course belonging to another organization', async () => {
    const res = await request(
      makeApp({
        courses: [
          { ...COURSE, id: OTHER_ORG_COURSE_ID, organization_id: 'org-2' },
        ],
      })
    )
      .patch(`/api/courses/${OTHER_ORG_COURSE_ID}/template`)
      .send({ certificateTemplate: 'modern' });
    expect(res.status).toBe(404);
  });

  it('404s on a nonexistent course', async () => {
    const res = await request(makeApp({ courses: [] }))
      .patch(`/api/courses/${MISSING_COURSE_ID}/template`)
      .send({ certificateTemplate: 'modern' });
    expect(res.status).toBe(404);
  });

  it('rejects a non-issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    )
      .patch(`/api/courses/${COURSE_ID}/template`)
      .send({ certificateTemplate: 'modern' });
    expect(res.status).toBe(403);
  });
});
