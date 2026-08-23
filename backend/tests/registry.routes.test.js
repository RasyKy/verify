import express from 'express';
import request from 'supertest';

import { createRegistryRouter } from '../src/routes/registry.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

/** A minimal chainable fake matching the `.from().select().eq().eq().order()` shape. */
function makeAdminClient({ organizations = [], error = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push({ table });
      const chain = {
        select(cols) {
          calls.push({ select: cols });
          return chain;
        },
        eq(col, val) {
          calls.push({ eq: [col, val] });
          return chain;
        },
        order(col, opts) {
          calls.push({ order: [col, opts] });
          return Promise.resolve(
            error ? { data: null, error } : { data: organizations, error: null }
          );
        },
      };
      return chain;
    },
  };
}

function makeApp({ adminClient = makeAdminClient() } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api', createRegistryRouter({ adminClient }));
  app.use(errorHandler);
  return app;
}

describe('GET /api/registry — public', () => {
  it('returns accredited, active organizations mapped to camelCase', async () => {
    const adminClient = makeAdminClient({
      organizations: [
        {
          id: 'org-1',
          name: 'Royal University of Phnom Penh',
          type: 'university',
          logo_url: '/rupp-logo.png',
          joined_at: '2024-01-15',
        },
        {
          // No logo set: the column is nullable, and the registry must answer
          // null rather than omit the key, so the frontend can branch on it.
          id: 'org-2',
          name: 'Delta Polytechnic',
          type: 'bootcamp',
          joined_at: '2024-03-02',
        },
      ],
    });

    const res = await request(makeApp({ adminClient })).get('/api/registry');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'org-1',
        name: 'Royal University of Phnom Penh',
        type: 'university',
        logoUrl: '/rupp-logo.png',
        joinedAt: '2024-01-15',
      },
      {
        id: 'org-2',
        name: 'Delta Polytechnic',
        type: 'bootcamp',
        logoUrl: null,
        joinedAt: '2024-03-02',
      },
    ]);
  });

  it('filters on both accredited = true and status = active', async () => {
    const adminClient = makeAdminClient({ organizations: [] });

    await request(makeApp({ adminClient })).get('/api/registry');

    const eqCalls = adminClient.calls.filter((c) => c.eq).map((c) => c.eq);
    expect(eqCalls).toContainEqual(['accredited', true]);
    expect(eqCalls).toContainEqual(['status', 'active']);
  });

  it('returns an empty array when no organizations are accredited', async () => {
    const res = await request(
      makeApp({ adminClient: makeAdminClient({ organizations: [] }) })
    ).get('/api/registry');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('sets a public cache-control header', async () => {
    const res = await request(makeApp()).get('/api/registry');

    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('requires no authentication', async () => {
    const res = await request(makeApp()).get('/api/registry');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('propagates a database error to the central error handler', async () => {
    const adminClient = makeAdminClient({
      error: { message: 'connection reset', code: 'PGRST000' },
    });

    const res = await request(makeApp({ adminClient })).get('/api/registry');

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
