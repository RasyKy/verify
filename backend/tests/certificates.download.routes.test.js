/**
 * GET /api/certificates/:id/download — hermetic. Both certificateService and
 * certificateRenderService are injected fakes, so this suite never hits a
 * real database, chain, or Chromium.
 */
import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import { createCertificatesRouter } from '../src/routes/certificates.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { upstreamUnavailable } from '../src/lib/errors.js';

const CERT_ID = '11111111-1111-4111-8111-111111111111';

const VERIFIED_CERTIFICATE = {
  studentName: 'Chea Sophat',
  courseName: 'Web Development Fundamentals',
  institutionName: 'Royal Phnom Penh University',
  completionDate: '2026-02-03',
  expiryDate: null,
  certId: CERT_ID,
  issuedAtBlockchainTimestamp: '2026-02-03T09:15:22.000Z',
  logoUrl: null,
  signatureUrl: null,
  signatoryName: 'Dr. Sok Dara',
  signatoryTitle: 'Dean',
  certificateTemplate: 'classic',
};

function makeApp({ service = {}, renderService = {} } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createCertificatesRouter({
      service: {
        verify: async () => ({
          status: 'verified',
          certificate: VERIFIED_CERTIFICATE,
        }),
        logVerification: async () => {},
        ...service,
      },
      renderService: {
        renderPdf: async () => Buffer.from('%PDF-fake'),
        renderPng: async () => Buffer.from('PNG-fake'),
        ...renderService,
      },
    })
  );
  app.use(errorHandler);
  return app;
}

describe('GET /api/certificates/:id/download', () => {
  it('defaults to PDF and sets a download filename', async () => {
    const res = await request(makeApp()).get(
      `/api/certificates/${CERT_ID}/download`
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(
      `certificate-${CERT_ID}.pdf`
    );
  });

  it('renders PNG when format=png', async () => {
    const res = await request(makeApp()).get(
      `/api/certificates/${CERT_ID}/download?format=png`
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-disposition']).toContain(
      `certificate-${CERT_ID}.png`
    );
  });

  it('rejects an unknown format', async () => {
    const res = await request(makeApp()).get(
      `/api/certificates/${CERT_ID}/download?format=exe`
    );
    expect(res.status).toBe(422);
  });

  it('defaults size to "full" and passes it through to renderPng', async () => {
    const renderPng = jest.fn(async () => Buffer.from('PNG-fake'));
    await request(makeApp({ renderService: { renderPng } })).get(
      `/api/certificates/${CERT_ID}/download?format=png`
    );

    expect(renderPng).toHaveBeenCalledWith(expect.anything(), { size: 'full' });
  });

  it('passes size=thumb through to renderPng for dashboard card previews', async () => {
    const renderPng = jest.fn(async () => Buffer.from('PNG-fake'));
    const res = await request(makeApp({ renderService: { renderPng } })).get(
      `/api/certificates/${CERT_ID}/download?format=png&size=thumb`
    );

    expect(res.status).toBe(200);
    expect(renderPng).toHaveBeenCalledWith(expect.anything(), {
      size: 'thumb',
    });
  });

  it('rejects an unknown size', async () => {
    const res = await request(makeApp()).get(
      `/api/certificates/${CERT_ID}/download?format=png&size=huge`
    );
    expect(res.status).toBe(422);
  });

  it('404s when the certificate does not verify', async () => {
    const service = {
      verify: async () => ({ status: 'invalid', certificate: null }),
    };
    const res = await request(makeApp({ service })).get(
      `/api/certificates/${CERT_ID}/download`
    );
    expect(res.status).toBe(404);
  });

  it('still renders a revoked certificate — same status a viewer would see', async () => {
    const renderPdf = jest.fn(async () => Buffer.from('%PDF-fake'));
    const service = {
      verify: async () => ({
        status: 'revoked',
        certificate: VERIFIED_CERTIFICATE,
      }),
    };
    const res = await request(
      makeApp({ service, renderService: { renderPdf } })
    ).get(`/api/certificates/${CERT_ID}/download`);

    expect(res.status).toBe(200);
    expect(renderPdf).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'revoked' })
    );
  });

  it('never sends branding fields toward hash computation — passes only render-facing data', async () => {
    const renderPdf = jest.fn(async () => Buffer.from('%PDF-fake'));
    await request(makeApp({ renderService: { renderPdf } })).get(
      `/api/certificates/${CERT_ID}/download`
    );

    const [renderData] = renderPdf.mock.calls[0];
    expect(renderData).toMatchObject({
      studentName: 'Chea Sophat',
      courseName: 'Web Development Fundamentals',
      certificateTemplate: 'classic',
      signatoryName: 'Dr. Sok Dara',
    });
    expect(renderData.verifyUrl).toContain(CERT_ID);
  });

  it('resolves a root-relative logoUrl/signatureUrl against the frontend origin — Puppeteer has no base URL of its own to resolve them against', async () => {
    const renderPdf = jest.fn(async () => Buffer.from('%PDF-fake'));
    const service = {
      verify: async () => ({
        status: 'verified',
        certificate: {
          ...VERIFIED_CERTIFICATE,
          logoUrl: '/rupp-logo.png',
          signatureUrl: '/signatures/dara.png',
        },
      }),
    };
    await request(makeApp({ service, renderService: { renderPdf } })).get(
      `/api/certificates/${CERT_ID}/download`
    );

    const [renderData] = renderPdf.mock.calls[0];
    expect(renderData.logoUrl).toBe('http://localhost:3000/rupp-logo.png');
    expect(renderData.signatureUrl).toBe(
      'http://localhost:3000/signatures/dara.png'
    );
  });

  it('leaves an already-absolute logoUrl (a real Supabase Storage upload) unchanged', async () => {
    const renderPdf = jest.fn(async () => Buffer.from('%PDF-fake'));
    const absoluteLogo =
      'https://project.supabase.co/storage/v1/object/public/organization-assets/org-1/logo.png';
    const service = {
      verify: async () => ({
        status: 'verified',
        certificate: { ...VERIFIED_CERTIFICATE, logoUrl: absoluteLogo },
      }),
    };
    await request(makeApp({ service, renderService: { renderPdf } })).get(
      `/api/certificates/${CERT_ID}/download`
    );

    const [renderData] = renderPdf.mock.calls[0];
    expect(renderData.logoUrl).toBe(absoluteLogo);
  });

  it('sets a short, not absent, cache lifetime — the render bakes in a live status stamp, so caching too long risks a stale "looks valid" image after a revoke', async () => {
    const res = await request(makeApp()).get(
      `/api/certificates/${CERT_ID}/download`
    );
    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('surfaces a renderer failure as 503', async () => {
    const renderService = {
      renderPdf: async () => {
        throw upstreamUnavailable('Rendering');
      },
    };
    const res = await request(makeApp({ renderService })).get(
      `/api/certificates/${CERT_ID}/download`
    );
    expect(res.status).toBe(503);
  });

  it('rejects a malformed certificate ID', async () => {
    const res = await request(makeApp()).get(
      '/api/certificates/not-a-uuid/download'
    );
    expect(res.status).toBe(422);
  });
});
