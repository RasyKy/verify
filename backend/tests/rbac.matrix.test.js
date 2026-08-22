/**
 * The RBAC matrix that db/migrations/0002_rls.sql relies on.
 *
 * RLS is deny-by-default with no policies for `anon` or `authenticated`, and
 * all data access goes through the service-role key, which bypasses RLS
 * entirely. That is a deliberate trade recorded in 0002: authorization lives in
 * exactly one place, so there is no second, easily-mismatched set of SQL
 * policies to keep in agreement — but it also means a route that forgets its
 * guard has nothing behind it.
 *
 * This file is the second line of defence. It walks every route and asserts
 * what each role may and may not reach, so a missing `requireRole` fails here
 * rather than in production.
 *
 * The services are faked: this tests the GUARDS, not the behaviour behind them.
 * A route that lets the wrong role through reaches a fake that records the call
 * and returns a benign value, so an authorization hole shows up as an
 * unexpected 200 rather than an incidental crash.
 */
import express from 'express';
import request from 'supertest';

import { createAdminRouter } from '../src/routes/admin.js';
import { createAuthRouter } from '../src/routes/auth.js';
import { createCertificateRouter } from '../src/routes/certificates.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const ID = '33333333-3333-4333-8333-333333333333';

/** Every caller shape the API can see, including "nobody". */
const ACTORS = {
  anonymous: null,
  holder: {
    id: 'u-holder',
    email: 'h@x.com',
    role: 'holder',
    organizationId: null,
  },
  issuer: {
    id: 'u-issuer',
    email: 'i@x.com',
    role: 'issuer',
    organizationId: ORG,
  },
  // An issuer whose account exists but was never linked to an institution.
  orphanIssuer: {
    id: 'u-orphan',
    email: 'o@x.com',
    role: 'issuer',
    organizationId: null,
  },
  admin: {
    id: 'u-admin',
    email: 'a@x.com',
    role: 'admin',
    organizationId: null,
  },
};

/**
 * Fakes that succeed at whatever they are asked, so any status other than
 * 401/403 means the request got through the guards.
 */
const certificateService = {
  issue: async () => ({ id: ID }),
  list: async () => ({ total: 0, certificates: [] }),
  getById: async () => ({ id: ID }),
  revoke: async () => ({ id: ID, status: 'revoked' }),
  verifyByCertId: async () => ({ status: 'verified', certificate: null }),
};

const adminService = {
  inviteUser: async () => ({ id: 'new-user' }),
  listUsers: async () => ({ total: 0, users: [] }),
  setUserStatus: async () => ({ id: ID }),
  createOrganization: async () => ({ id: ORG }),
  listOrganizations: async () => ({ total: 0, organizations: [] }),
  setOrganizationStatus: async () => ({ id: ORG }),
};

function makeApp(actor) {
  const app = express();
  app.use(express.json());

  const requireAuth = (req, res, next) => {
    if (!actor) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } });
    }
    req.user = actor;
    next();
  };

  app.use(
    '/api/certificates',
    createCertificateRouter({ service: certificateService, requireAuth })
  );
  app.use(
    '/api/admin',
    createAdminRouter({ service: adminService, requireAuth })
  );
  app.use(
    '/api/auth',
    createAuthRouter({
      getAuthClient: () => ({
        auth: {
          signInWithPassword: async () => ({
            data: {
              user: { id: 'u1', email: 'x@y.com' },
              session: { access_token: 'a', refresh_token: 'r', expires_at: 1 },
            },
            error: null,
          }),
        },
      }),
      adminClient: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
      requireAuth,
    })
  );

  app.use(errorHandler);
  return app;
}

/**
 * The matrix. `allow` lists every role that must reach the route; every other
 * actor must be refused with 401 (no session) or 403 (wrong role).
 */
const ROUTES = [
  // ── Public ──────────────────────────────────────────────────────────────
  {
    name: 'GET /api/certificates/verify/:certId',
    method: 'get',
    path: `/api/certificates/verify/${ID}`,
    allow: ['anonymous', 'holder', 'issuer', 'orphanIssuer', 'admin'],
  },
  {
    name: 'POST /api/auth/login',
    method: 'post',
    path: '/api/auth/login',
    body: { email: 'x@y.com', password: 'whatever' },
    allow: ['anonymous', 'holder', 'issuer', 'orphanIssuer', 'admin'],
  },

  // ── Issuer scope ────────────────────────────────────────────────────────
  // orphanIssuer is excluded everywhere: requireOrganization rejects an issuer
  // with no institution, because its certificates would be unscoped.
  {
    // Admin is NOT allowed: certificates.organization_id is NOT NULL and a
    // platform admin belongs to no institution, so there is no correct value
    // to record. Reading and revoking below are a different matter.
    name: 'POST /api/certificates',
    method: 'post',
    path: '/api/certificates',
    body: {
      studentName: 'A Student',
      studentEmail: 'student@example.com',
      courseName: 'A Course',
      completionDate: '2025-01-01',
    },
    allow: ['issuer'],
  },
  {
    name: 'GET /api/certificates',
    method: 'get',
    path: '/api/certificates',
    allow: ['issuer', 'admin'],
  },
  {
    name: 'GET /api/certificates/:id',
    method: 'get',
    path: `/api/certificates/${ID}`,
    allow: ['issuer', 'admin'],
  },
  {
    name: 'POST /api/certificates/:id/revoke',
    method: 'post',
    path: `/api/certificates/${ID}/revoke`,
    body: {},
    allow: ['issuer', 'admin'],
  },

  // ── Authenticated, any role ─────────────────────────────────────────────
  {
    name: 'GET /api/auth/me',
    method: 'get',
    path: '/api/auth/me',
    allow: ['holder', 'issuer', 'orphanIssuer', 'admin'],
  },

  // ── Admin only ──────────────────────────────────────────────────────────
  {
    name: 'POST /api/admin/users',
    method: 'post',
    path: '/api/admin/users',
    body: {
      email: 'new.issuer@example.com',
      fullName: 'New Issuer',
      role: 'issuer',
      organizationId: ORG,
    },
    allow: ['admin'],
  },
  {
    name: 'GET /api/admin/users',
    method: 'get',
    path: '/api/admin/users',
    allow: ['admin'],
  },
  {
    name: 'PATCH /api/admin/users/:id',
    method: 'patch',
    path: `/api/admin/users/${ID}`,
    body: { status: 'deactivated' },
    allow: ['admin'],
  },
  {
    name: 'POST /api/admin/organizations',
    method: 'post',
    path: '/api/admin/organizations',
    body: { name: 'New Institute', type: 'university' },
    allow: ['admin'],
  },
  {
    name: 'GET /api/admin/organizations',
    method: 'get',
    path: '/api/admin/organizations',
    allow: ['admin'],
  },
  {
    name: 'PATCH /api/admin/organizations/:id',
    method: 'patch',
    path: `/api/admin/organizations/${ORG}`,
    body: { status: 'suspended' },
    allow: ['admin'],
  },
];

describe('RBAC matrix', () => {
  for (const route of ROUTES) {
    describe(route.name, () => {
      for (const actorName of Object.keys(ACTORS)) {
        const permitted = route.allow.includes(actorName);

        it(`${permitted ? 'allows' : 'refuses'} ${actorName}`, async () => {
          const app = makeApp(ACTORS[actorName]);
          const req = request(app)[route.method](route.path);
          const res = route.body ? await req.send(route.body) : await req;

          if (permitted) {
            // Anything but an auth failure means the guards let it through.
            expect([401, 403]).not.toContain(res.status);
          } else {
            expect([401, 403]).toContain(res.status);
          }
        });
      }
    });
  }
});

describe('guard-by-default', () => {
  it('refuses an unknown admin path rather than falling through', async () => {
    // router.use(requireAuth, requireRole) applies to the whole admin router,
    // so a route added later without its own guard is still protected.
    const res = await request(makeApp(ACTORS.issuer)).get(
      '/api/admin/some-future-endpoint'
    );
    expect([401, 403]).toContain(res.status);
  });

  it('refuses an anonymous caller on an unknown admin path', async () => {
    const res = await request(makeApp(null)).get('/api/admin/anything');
    expect(res.status).toBe(401);
  });
});
