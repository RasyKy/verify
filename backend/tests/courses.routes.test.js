/**
 * Course + badge endpoint tests.
 *
 * Hermetic — a fake Supabase client is injected into the router factory, same
 * pattern as holder.routes.test.js. Storage is also faked via the router
 * factory's uploadBadge/deleteBadge overrides, so no real Supabase Storage
 * call ever happens in this suite.
 */
import express from 'express';
import request from 'supertest';

import { createCoursesRouter } from '../src/routes/courses.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { upstreamUnavailable } from '../src/lib/errors.js';

const ISSUER = {
  id: 'issuer-1',
  email: 'issuer.rupp@example.com',
  role: 'issuer',
  organizationId: 'org-1',
};

const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG_COURSE_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_COURSE_ID = '99999999-9999-4999-8999-999999999999';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

/** Same fakeDb shape used by holder.routes.test.js, with insert() added. */
function fakeDb(tables = {}) {
  function from(table) {
    const rows = tables[table];
    if (!rows) {
      throw new Error(`fakeDb: unexpected table "${table}"`);
    }
    const filters = [];
    let pendingUpdate = null;
    let pendingInsert = null;
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
      insert: (patch) => {
        pendingInsert = { id: `new-${rows.length + 1}`, ...patch };
        rows.push(pendingInsert);
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

function makeApp({
  courses = [],
  user = ISSUER,
  uploadBadge = async () =>
    'https://storage.example/course-badges/org-1/course.png?v=1',
  deleteBadge = async () => {},
} = {}) {
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
      uploadBadge,
      deleteBadge,
    })
  );
  app.use(errorHandler);
  return app;
}

const COURSE = {
  id: COURSE_ID,
  name: 'Blockchain for Developers',
  organization_id: 'org-1',
  badge_url: null,
};

describe('GET /api/courses', () => {
  it('is unaffected by the badge feature — still a bare string array', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] })).get(
      '/api/courses'
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Blockchain for Developers']);
  });
});

describe('GET /api/courses/full', () => {
  it('returns badgeUrl alongside id and name', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE, badge_url: 'https://x/badge.png' }] })
    ).get('/api/courses/full');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: COURSE_ID,
        name: 'Blockchain for Developers',
        badgeUrl: 'https://x/badge.png',
      },
    ]);
  });

  it('returns badgeUrl: null for a course with no badge', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] })).get(
      '/api/courses/full'
    );
    expect(res.body[0].badgeUrl).toBeNull();
  });

  it('requires an issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    ).get('/api/courses/full');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/courses/:id/badge', () => {
  it('uploads a valid PNG and returns the updated badgeUrl', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.badgeUrl).toContain('course-badges');
  });

  it('uploads a valid JPEG', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', JPEG_SIGNATURE, {
        filename: 'badge.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
  });

  it('rejects a file whose bytes do not match its declared type', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', Buffer.from('not actually a png'), {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
  });

  it('rejects a disallowed file type outright (e.g. SVG)', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', Buffer.from('<svg></svg>'), {
        filename: 'badge.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
  });

  it('rejects an oversized file', async () => {
    const big = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await request(makeApp({ courses: [{ ...COURSE }] }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', big, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
  });

  it('404s on a course belonging to another organization', async () => {
    const res = await request(
      makeApp({
        courses: [
          { ...COURSE, id: OTHER_ORG_COURSE_ID, organization_id: 'org-2' },
        ],
      })
    )
      .post(`/api/courses/${OTHER_ORG_COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(404);
  });

  it('404s on a nonexistent course', async () => {
    const res = await request(makeApp({ courses: [] }))
      .post(`/api/courses/${MISSING_COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(404);
  });

  it('rejects a non-issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    )
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }], user: null }))
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
  });

  it('400s when no file is attached', async () => {
    const res = await request(makeApp({ courses: [{ ...COURSE }] })).post(
      `/api/courses/${COURSE_ID}/badge`
    );
    expect(res.status).toBe(400);
  });

  it('surfaces a storage failure as 503, not a 500 or a silent success', async () => {
    const res = await request(
      makeApp({
        courses: [{ ...COURSE }],
        uploadBadge: async () => {
          throw upstreamUnavailable('Storage');
        },
      })
    )
      .post(`/api/courses/${COURSE_ID}/badge`)
      .attach('badge', PNG_SIGNATURE, {
        filename: 'badge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(503);
  });
});

describe('DELETE /api/courses/:id/badge', () => {
  it('clears the badge and returns badgeUrl: null', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE, badge_url: 'https://x/badge.png' }] })
    ).delete(`/api/courses/${COURSE_ID}/badge`);

    expect(res.status).toBe(200);
    expect(res.body.badgeUrl).toBeNull();
  });

  it('404s on a course belonging to another organization', async () => {
    const res = await request(
      makeApp({
        courses: [
          { ...COURSE, id: OTHER_ORG_COURSE_ID, organization_id: 'org-2' },
        ],
      })
    ).delete(`/api/courses/${OTHER_ORG_COURSE_ID}/badge`);

    expect(res.status).toBe(404);
  });

  it('rejects a non-issuer role', async () => {
    const res = await request(
      makeApp({ courses: [{ ...COURSE }], user: { ...ISSUER, role: 'holder' } })
    ).delete(`/api/courses/${COURSE_ID}/badge`);
    expect(res.status).toBe(403);
  });
});
