/**
 * Server-side certificate rendering — PDF and PNG, via Puppeteer.
 *
 * Institution branding (logo, signature, signatory) and template choice are
 * PURELY PRESENTATIONAL. Nothing here, or in templates/certificates/, is
 * read by services/hash.js — the render input is the already-verified
 * output of certificateService.verify(), never the other way around. See
 * db/migrations/0006_certificate_branding.sql.
 *
 * Deploy note: uses puppeteer-core + @sparticuz/chromium rather than full
 * puppeteer, specifically because the backend deploys to Render's native
 * Node runtime (no Docker, no apt-get) — full puppeteer's bundled Chromium
 * needs system libraries that runtime has no way to install. sparticuz ships
 * a Chromium build made for exactly this kind of constrained environment.
 */
import QRCode from 'qrcode';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { upstreamUnavailable } from '../lib/errors.js';
import { renderCertificateHtml } from '../templates/certificates/index.js';

/**
 * Chromium is memory-heavy and Render's starter instance is small — the
 * same process also runs the node-cron expiry job. Capping concurrent
 * renders keeps a burst of downloads from OOM-killing the whole backend.
 */
const CONCURRENCY_LIMIT = 2;

/** 1600x1131 ~= a landscape A4-ish canvas at a resolution good enough for print. */
const PAGE_WIDTH = 1600;
const PAGE_HEIGHT = 1131;

/**
 * @sparticuz/chromium only ships Linux binaries — it cannot launch on a
 * developer's Windows/macOS machine at all. Production (Render, Linux) uses
 * it; local dev drives whatever Chrome is already installed via
 * puppeteer-core's `channel: 'chrome'` launch, rather than bundling a second
 * Chromium download just for dev machines.
 */
async function defaultLaunchBrowser() {
  const puppeteer = await import('puppeteer-core');

  if (env.isProduction) {
    const { default: chromium } = await import('@sparticuz/chromium');
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  return puppeteer.launch({ channel: 'chrome', headless: true });
}

export function createCertificateRenderService({
  launchBrowser = defaultLaunchBrowser,
} = {}) {
  /** Lazily launched, kept alive for the process lifetime — not one browser per request. */
  let browserPromise = null;
  let active = 0;
  const queue = [];

  function getBrowser() {
    if (!browserPromise) {
      browserPromise = launchBrowser().catch((err) => {
        browserPromise = null; // let the next call retry instead of caching a failure
        throw err;
      });
    }
    return browserPromise;
  }

  /** Simple counting semaphore — no queue library needed for a cap of 2. */
  async function withSlot(fn) {
    if (active >= CONCURRENCY_LIMIT) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }

  async function buildRenderData(data) {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
      width: 300,
      margin: 1,
      // 'H' (~30% correctable) rather than the default 'M' (~15%) — the
      // classic template overlays our own mark on the center of the code,
      // and this is the error-correction headroom that overlay needs to
      // stay reliably scannable.
      errorCorrectionLevel: 'H',
    });
    // Verify's own mark, not the issuing institution's — every certificate's
    // QR points at OUR verify page, regardless of who issued it, so it
    // should read as "check this on Verify", not carry a random institution
    // logo. /favicon.svg specifically, not /logo.png: it's the mark already
    // designed and proven legible at small sizes (that's what a favicon is
    // for), where the fuller wordmark composition would just blur into noise
    // at 22px. Root-relative, so it needs the same origin resolution the
    // route layer already applies to institution assets — see
    // routes/certificates.js's resolveAssetUrl() for why page.setContent()
    // can't resolve a bare "/favicon.svg" on its own.
    const qrLogoUrl = new URL('/favicon.svg', env.publicAppUrl).href;
    return { ...data, qrDataUrl, qrLogoUrl };
  }

  async function renderPage(data) {
    let browser;
    try {
      browser = await getBrowser();
    } catch (err) {
      logger.error('could not launch render browser', { err });
      throw upstreamUnavailable(
        'Rendering',
        'Could not generate the certificate document right now.'
      );
    }

    const html = renderCertificateHtml(
      data.certificateTemplate,
      await buildRenderData(data)
    );

    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return page;
    } catch (err) {
      await page.close();
      throw err;
    }
  }

  function renderPdf(data) {
    return withSlot(async () => {
      const page = await renderPage(data);
      try {
        return await page.pdf({
          width: `${PAGE_WIDTH}px`,
          height: `${PAGE_HEIGHT}px`,
          printBackground: true,
          pageRanges: '1',
        });
      } finally {
        await page.close();
      }
    });
  }

  /**
   * `size: 'thumb'` (dashboard card previews) drops deviceScaleFactor from 2
   * to 1 — same 1600x1131 viewport, so the template's fixed-px layout
   * (fitFontSize() etc. in templates/certificates/shared.js) is identical,
   * only the final raster resolution is smaller. That's ~4x fewer pixels to
   * encode and transfer for an image that's immediately downscaled into a
   * small card anyway (CertificateCard.vue). `size: 'full'` (default) is
   * unchanged — real downloads and the detail-modal preview keep print
   * quality.
   */
  function renderPng(data, { size = 'full' } = {}) {
    return withSlot(async () => {
      const page = await renderPage(data);
      try {
        await page.setViewport({
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          deviceScaleFactor: size === 'thumb' ? 1 : 2,
        });
        return await page.screenshot({ type: 'png' });
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Fire-and-forget browser launch, called once at process startup
   * (server.js). The browser is normally launched lazily on the first real
   * render (getBrowser(), above) — without this, that first render is
   * whoever's request happens to land first, typically a real user's first
   * dashboard visit shortly after a deploy/restart. Warming it up here moves
   * that launch latency off the request path entirely. A failure here isn't
   * fatal: it's logged and the next real request just retries the launch
   * the way it always has.
   */
  function warmUp() {
    return getBrowser().catch((err) => {
      logger.warn('render browser warm-up failed', { err });
    });
  }

  /** For graceful shutdown (server.js) and test teardown. */
  async function close() {
    if (!browserPromise) return;
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (err) {
      logger.warn('error closing render browser', { err });
    } finally {
      browserPromise = null;
    }
  }

  return { renderPdf, renderPng, warmUp, close };
}

/** Process-wide instance used by the routes. */
export const certificateRenderService = createCertificateRenderService();
