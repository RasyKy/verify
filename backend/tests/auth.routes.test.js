/**
 * Auth endpoint tests.
 *
 * Hermetic: a fake Supabase client is injected into the router factory, so
 * these run with no network and no credentials. They pin the contract the
 * frontend depends on — the token shape on login, uniform failure messages,
 * and that validation rejects bad input before any Supabase call.
 */
import express from 'express';
import request from 'supertest';

import { createAuthRouter } from '../src/routes/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

/** Builds an app around the auth router with injected fakes. */
function makeApp({ authClient, adminClient, user } = {}) {
  const app = express();
  app.use(express.json());
  const router = createAuthRouter({
    getAuthClient: () => authClient,
    adminClient,
    // Fake auth middleware: attaches the given user, or 401s.
    requireAuth: (req, res, next) => {
      if (!user)
        return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
      req.user = user;
      req.token = 'fake-token';
      next();
    },
  });
  app.use('/api/auth', router);
  app.use(errorHandler);
  return app;
}

describe('POST /api/auth/login', () => {
  it('returns tokens in the shape the frontend expects', async () => {
    const authClient = {
      auth: {
        signInWithPassword: async () => ({
          data: {
            user: { id: 'u1', email: 'issuer@rppu.edu.kh' },
            session: {
              access_token: 'access-xyz',
              refresh_token: 'refresh-xyz',
              expires_at: 1893456000,
            },
          },
          error: null,
        }),
      },
    };
    const res = await request(makeApp({ authClient }))
      .post('/api/auth/login')
      .send({ email: 'issuer@rppu.edu.kh', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: 'u1', email: 'issuer@rppu.edu.kh' },
      accessToken: 'access-xyz',
      refreshToken: 'refresh-xyz',
      expiresAt: 1893456000,
    });
  });

  it('maps a Supabase auth error to a uniform 401 (no account enumeration)', async () => {
    const authClient = {
      auth: {
        signInWithPassword: async () => ({
          data: {},
          error: { message: 'Invalid login credentials' },
        }),
      },
    };
    const res = await request(makeApp({ authClient }))
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
    // The upstream reason must not leak — same message whether or not the
    // email exists.
    expect(JSON.stringify(res.body)).not.toContain('Invalid login credentials');
  });

  it('rejects a malformed email before calling Supabase', async () => {
    let called = false;
    const authClient = {
      auth: {
        signInWithPassword: async () => {
          called = true;
          return { data: {}, error: null };
        },
      },
    };
    const res = await request(makeApp({ authClient }))
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'x' });

    expect(res.status).toBe(422);
    expect(called).toBe(false);
  });

  it('rejects a missing password', async () => {
    const res = await request(makeApp({ authClient: {} }))
      .post('/api/auth/login')
      .send({ email: 'a@b.com' });
    expect(res.status).toBe(422);
  });

  it('rejects unknown fields', async () => {
    const res = await request(makeApp({ authClient: {} }))
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'x', role: 'admin' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a fresh session', async () => {
    const authClient = {
      auth: {
        refreshSession: async () => ({
          data: {
            session: {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              expires_at: 1893456000,
            },
          },
          error: null,
        }),
      },
    };
    const res = await request(makeApp({ authClient }))
      .post('/api/auth/refresh')
      .send({ refreshToken: 'old-refresh' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-access');
    expect(res.body.refreshToken).toBe('new-refresh');
  });

  it('401s on an invalid refresh token', async () => {
    const authClient = {
      auth: {
        refreshSession: async () => ({ data: {}, error: { message: 'bad' } }),
      },
    };
    const res = await request(makeApp({ authClient }))
      .post('/api/auth/refresh')
      .send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  it('422s when refreshToken is missing', async () => {
    const res = await request(makeApp({ authClient: {} }))
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/logout', () => {
  it('401s without a token', async () => {
    const res = await request(makeApp({})).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('succeeds and revokes the session for an authenticated caller', async () => {
    let revoked = false;
    const adminClient = {
      auth: {
        admin: {
          signOut: async () => {
            revoked = true;
          },
        },
      },
    };
    const res = await request(
      makeApp({
        adminClient,
        user: { id: 'u1', email: 'a@b.com', role: 'holder' },
      })
    ).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(revoked).toBe(true);
  });

  it('still succeeds if the upstream revoke fails (best-effort)', async () => {
    const adminClient = {
      auth: {
        admin: {
          signOut: async () => {
            throw new Error('supabase down');
          },
        },
      },
    };
    const res = await request(
      makeApp({
        adminClient,
        user: { id: 'u1', email: 'a@b.com', role: 'holder' },
      })
    ).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('401s without a token', async () => {
    const res = await request(makeApp({})).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns profile + organization for an issuer', async () => {
    const adminClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'org1',
                name: 'RPPU',
                slug: 'rppu',
                type: 'university',
                status: 'active',
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    const res = await request(
      makeApp({
        adminClient,
        user: {
          id: 'u1',
          email: 'i@rppu.edu.kh',
          role: 'issuer',
          organizationId: 'org1',
        },
      })
    ).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('issuer');
    expect(res.body.organization.name).toBe('RPPU');
  });

  it('returns null organization for a holder', async () => {
    const res = await request(
      makeApp({
        adminClient: {},
        user: {
          id: 'u2',
          email: 'h@gmail.com',
          role: 'holder',
          organizationId: null,
        },
      })
    ).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.organization).toBeNull();
  });
});

describe('GET /api/auth/account-exists', () => {
  function adminWithProfile(exists) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: exists ? { id: 'p1' } : null,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  it('reports true when a profile exists', async () => {
    const res = await request(
      makeApp({ adminClient: adminWithProfile(true) })
    ).get('/api/auth/account-exists?email=has@account.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true });
  });

  it('reports false when none exists', async () => {
    const res = await request(
      makeApp({ adminClient: adminWithProfile(false) })
    ).get('/api/auth/account-exists?email=new@user.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it('422s on a malformed email', async () => {
    const res = await request(
      makeApp({ adminClient: adminWithProfile(false) })
    ).get('/api/auth/account-exists?email=nope');
    expect(res.status).toBe(422);
  });
});
