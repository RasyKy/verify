/**
 * Organization branding endpoint tests.
 *
 * Hermetic — a fake Supabase client is injected into the router factory, same
 * pattern as courses.routes.test.js. Storage is faked via the router
 * factory's upload/delete overrides, so no real Supabase Storage call ever
 * happens in this suite.
 */
import express from 'express';
import request from 'supertest';

import { createOrganizationsRouter } from '../src/routes/organizations.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { upstreamUnavailable } from '../src/lib/errors.js';

const ISSUER = {
  id: 'issuer-1',
  email: 'issuer.rupp@example.com',
  role: 'issuer',
  organizationId: 'org-1',
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Same fakeDb shape used by courses.routes.test.js. */
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
      update: (patch) => {
        pendingUpdate = patch;
        return builder;
      },
      maybeSingle: () => {
        applyUpdate();
        const found = rows.find(matches) ?? null;
        return Promise.resolve({ data: found, error: null });
      },
      single: () => builder.maybeSingle(),
    };
    return builder;
  }
  return { from };
}

function makeApp({
  organizations,
  user = ISSUER,
  uploadLogo = async () =>
    'https://storage.example/organization-assets/org-1/logo.png?v=1',
  deleteLogo = async () => {},
  uploadSignature = async () =>
    'https://storage.example/organization-assets/org-1/signature.png?v=1',
  deleteSignature = async () => {},
} = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createOrganizationsRouter({
      adminClient: fakeDb({ organizations }),
      requireAuth: (req, res, next) => {
        if (!user) {
          return res
            .status(401)
            .json({ error: { code: 'UNAUTHENTICATED' }, message: 'no token' });
        }
        req.user = user;
        next();
      },
      uploadLogo,
      deleteLogo,
      uploadSignature,
      deleteSignature,
    })
  );
  app.use(errorHandler);
  return app;
}

const ORG = {
  id: 'org-1',
  name: 'Royal Phnom Penh University',
  logo_url: null,
  signature_url: null,
  signatory_name: null,
  signatory_title: null,
};

describe('GET /api/organizations/me', () => {
  it("returns the caller's organization, camelCased", async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] })).get(
      '/api/organizations/me'
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'org-1',
      name: 'Royal Phnom Penh University',
      logoUrl: null,
      signatureUrl: null,
      signatoryName: null,
      signatoryTitle: null,
    });
  });

  it('requires an issuer role', async () => {
    const res = await request(
      makeApp({
        organizations: [{ ...ORG }],
        user: { ...ISSUER, role: 'holder' },
      })
    ).get('/api/organizations/me');
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(
      makeApp({ organizations: [{ ...ORG }], user: null })
    ).get('/api/organizations/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/organizations/me', () => {
  it('updates the signatory name and title', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .patch('/api/organizations/me')
      .send({
        signatoryName: 'Dr. Sok Dara',
        signatoryTitle: 'Dean',
      });

    expect(res.status).toBe(200);
    expect(res.body.signatoryName).toBe('Dr. Sok Dara');
    expect(res.body.signatoryTitle).toBe('Dean');
  });

  it('rejects certificateTemplate — that is per-course now, not here', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .patch('/api/organizations/me')
      .send({ certificateTemplate: 'modern' });
    expect(res.status).toBe(422);
  });

  it('rejects unknown fields (strict schema)', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .patch('/api/organizations/me')
      .send({ logoUrl: 'https://evil.example/x.png' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/organizations/me/logo', () => {
  it('uploads a valid PNG and returns the updated logoUrl', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .post('/api/organizations/me/logo')
      .attach('logo', PNG_SIGNATURE, {
        filename: 'logo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toContain('organization-assets');
  });

  it('rejects a file whose bytes do not match its declared type', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .post('/api/organizations/me/logo')
      .attach('logo', Buffer.from('not actually a png'), {
        filename: 'logo.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
  });

  it('400s when no file is attached', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] })).post(
      '/api/organizations/me/logo'
    );
    expect(res.status).toBe(400);
  });

  it('surfaces a storage failure as 503', async () => {
    const res = await request(
      makeApp({
        organizations: [{ ...ORG }],
        uploadLogo: async () => {
          throw upstreamUnavailable('Storage');
        },
      })
    )
      .post('/api/organizations/me/logo')
      .attach('logo', PNG_SIGNATURE, {
        filename: 'logo.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(503);
  });
});

describe('DELETE /api/organizations/me/logo', () => {
  it('clears the logo and returns logoUrl: null', async () => {
    const res = await request(
      makeApp({ organizations: [{ ...ORG, logo_url: 'https://x/logo.png' }] })
    ).delete('/api/organizations/me/logo');

    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toBeNull();
  });
});

describe('POST /api/organizations/me/signature', () => {
  it('uploads a valid PNG and returns the updated signatureUrl', async () => {
    const res = await request(makeApp({ organizations: [{ ...ORG }] }))
      .post('/api/organizations/me/signature')
      .attach('signature', PNG_SIGNATURE, {
        filename: 'signature.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(200);
    expect(res.body.signatureUrl).toContain('organization-assets');
  });
});

describe('DELETE /api/organizations/me/signature', () => {
  it('clears the signature and returns signatureUrl: null', async () => {
    const res = await request(
      makeApp({
        organizations: [{ ...ORG, signature_url: 'https://x/sig.png' }],
      })
    ).delete('/api/organizations/me/signature');

    expect(res.status).toBe(200);
    expect(res.body.signatureUrl).toBeNull();
  });
});
