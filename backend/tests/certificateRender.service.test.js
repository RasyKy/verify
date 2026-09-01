/**
 * certificateRender.js — hermetic. A fake browser/page is injected via
 * launchBrowser, so no real Chromium is ever spawned in this suite (matches
 * this project's jest.mock()-free, constructor-injection test pattern — see
 * backend/README.md).
 */
import { jest } from '@jest/globals';

import { createCertificateRenderService } from '../src/services/certificateRender.js';

const RENDER_DATA = {
  studentName: 'Chea Sophat',
  courseName: 'Web Development Fundamentals',
  institutionName: 'Royal Phnom Penh University',
  completionDate: '2026-02-03',
  certId: '11111111-1111-4111-8111-111111111111',
  verifyUrl: 'https://verify.example/cert/11111111-1111-4111-8111-111111111111',
  logoUrl: null,
  signatureUrl: null,
  signatoryName: 'Dr. Sok Dara',
  signatoryTitle: 'Dean',
  certificateTemplate: 'classic',
  status: 'verified',
};

/** Records every page created, and lets a test control when setContent resolves. */
function fakeBrowser() {
  const pages = [];
  const browser = {
    newPage: async () => {
      const page = {
        setContent: jest.fn(async () => {}),
        setViewport: jest.fn(async () => {}),
        pdf: jest.fn(async () => Buffer.from('%PDF-fake')),
        screenshot: jest.fn(async () => Buffer.from('PNG-fake')),
        close: jest.fn(async () => {}),
      };
      pages.push(page);
      return page;
    },
    close: jest.fn(async () => {}),
  };
  return { browser, pages };
}

function makeService() {
  const { browser, pages } = fakeBrowser();
  const launchBrowser = jest.fn(async () => browser);
  const service = createCertificateRenderService({ launchBrowser });
  return { service, browser, pages, launchBrowser };
}

describe('certificateRenderService.renderPdf', () => {
  it('renders HTML for the requested template and returns a PDF buffer', async () => {
    const { service, pages } = makeService();
    const pdf = await service.renderPdf(RENDER_DATA);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pages).toHaveLength(1);
    expect(pages[0].setContent).toHaveBeenCalledTimes(1);
    const [html] = pages[0].setContent.mock.calls[0];
    expect(html).toContain('Chea Sophat');
    expect(html).toContain('Web Development Fundamentals');
    expect(pages[0].pdf).toHaveBeenCalledTimes(1);
    expect(pages[0].close).toHaveBeenCalledTimes(1);
  });

  it('picks the modern template when certificateTemplate is modern', async () => {
    const { service, pages } = makeService();
    await service.renderPdf({ ...RENDER_DATA, certificateTemplate: 'modern' });

    const [html] = pages[0].setContent.mock.calls[0];
    // Modern's own accent color, present only in that template.
    expect(html).toContain('#0F7B6C');
  });

  it('defaults to classic for an unrecognized template value', async () => {
    const { service, pages } = makeService();
    await service.renderPdf({
      ...RENDER_DATA,
      certificateTemplate: 'nonsense',
    });

    const [html] = pages[0].setContent.mock.calls[0];
    expect(html).toContain('Iowan Old Style');
  });

  it('escapes HTML in free-text fields', async () => {
    const { service, pages } = makeService();
    await service.renderPdf({
      ...RENDER_DATA,
      studentName: '<script>alert(1)</script>',
    });

    const [html] = pages[0].setContent.mock.calls[0];
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('stamps a revoked certificate visibly, unlike a verified one', async () => {
    const { service, pages } = makeService();
    await service.renderPdf({ ...RENDER_DATA, status: 'revoked' });

    const [html] = pages[0].setContent.mock.calls[0];
    expect(html).toContain('Revoked');
  });

  it('reuses one browser instance across multiple renders', async () => {
    const { service, launchBrowser } = makeService();
    await service.renderPdf(RENDER_DATA);
    await service.renderPdf(RENDER_DATA);
    await service.renderPng(RENDER_DATA);

    expect(launchBrowser).toHaveBeenCalledTimes(1);
  });
});

describe('certificateRenderService.renderPng', () => {
  it('sets a retina viewport and returns a PNG buffer', async () => {
    const { service, pages } = makeService();
    const png = await service.renderPng(RENDER_DATA);

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(pages[0].setViewport).toHaveBeenCalledWith(
      expect.objectContaining({ deviceScaleFactor: 2 })
    );
    expect(pages[0].screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'png' })
    );
  });

  it('defaults to full (retina) resolution when size is omitted', async () => {
    const { service, pages } = makeService();
    await service.renderPng(RENDER_DATA);

    expect(pages[0].setViewport).toHaveBeenCalledWith(
      expect.objectContaining({ deviceScaleFactor: 2 })
    );
  });

  it('renders at deviceScaleFactor 1 for size: thumb, same viewport width/height', async () => {
    const { service, pages } = makeService();
    await service.renderPng(RENDER_DATA, { size: 'thumb' });

    expect(pages[0].setViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1600,
        height: 1131,
        deviceScaleFactor: 1,
      })
    );
  });
});

describe('certificateRenderService.warmUp', () => {
  it('launches the browser without rendering a page', async () => {
    const { service, launchBrowser, pages } = makeService();
    await service.warmUp();

    expect(launchBrowser).toHaveBeenCalledTimes(1);
    expect(pages).toHaveLength(0);
  });

  it('reuses the warmed-up browser for a subsequent render', async () => {
    const { service, launchBrowser } = makeService();
    await service.warmUp();
    await service.renderPdf(RENDER_DATA);

    expect(launchBrowser).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the launch fails — logs and lets the next call retry', async () => {
    const failingLaunch = jest.fn(async () => {
      throw new Error('no chromium here');
    });
    const service = createCertificateRenderService({
      launchBrowser: failingLaunch,
    });

    await expect(service.warmUp()).resolves.toBeUndefined();
  });
});

/**
 * Polls instead of a fixed sleep — QR generation inside renderPage() is real,
 * uncontrolled work, and consistently takes ~2-2.5s under Jest's
 * --experimental-vm-modules runtime (vs. near-instant under plain Node),
 * so the timeout needs real headroom above that, not just above the fake
 * browser's own instant resolution.
 */
async function waitUntil(predicate, { timeout = 15000, interval = 25 } = {}) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('waitUntil: condition never became true');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

describe('certificateRenderService concurrency', () => {
  it('caps concurrent renders and queues the rest', async () => {
    const releasers = [];
    const browser = {
      newPage: async () => ({
        setContent: async () => {},
        setViewport: async () => {},
        pdf: () =>
          new Promise((resolve) => {
            releasers.push(() => resolve(Buffer.from('pdf')));
          }),
        screenshot: async () => Buffer.from('png'),
        close: async () => {},
      }),
      close: async () => {},
    };
    const service = createCertificateRenderService({
      launchBrowser: async () => browser,
    });

    const p1 = service.renderPdf(RENDER_DATA);
    const p2 = service.renderPdf(RENDER_DATA);
    const p3 = service.renderPdf(RENDER_DATA);

    // The first two renders' pdf() calls should register; the third stays
    // queued behind the concurrency cap until a slot frees up.
    await waitUntil(() => releasers.length === 2);
    expect(releasers).toHaveLength(2);

    releasers[0]();
    await waitUntil(() => releasers.length === 3);

    releasers[1]();
    releasers[2]();
    await Promise.all([p1, p2, p3]);
  });
});
