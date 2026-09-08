/**
 * Certificate rendering — @napi-rs/canvas edition.
 *
 * Replaces the Puppeteer-based renderer (certificateRender.js) for templates
 * that have been ported (currently: classic only — see drawClassic()'s
 * header comment for how the "baked background + dynamic overlay" split
 * works). Two things this buys over Puppeteer, concretely:
 *
 *  1. No headless browser: @napi-rs/canvas ships prebuilt native binaries
 *     per-platform (Windows/macOS/Linux) via the same npm package, so it
 *     runs identically in local dev and on Render — none of the
 *     dev-uses-real-Chrome / prod-uses-@sparticuz/chromium asymmetry that
 *     caused the version-drift bug this session spent a long time chasing.
 *  2. Orders of magnitude faster: a Skia canvas draw is single-digit-to-low-
 *     double-digit milliseconds; the old renderer's own page.setContent()
 *     wait alone (networkidle0) was in the hundreds of milliseconds, before
 *     the screenshot itself.
 *
 * Templates not yet ported fall back to the Puppeteer service — see
 * renderPng()/renderPdf() below.
 */
import crypto from 'node:crypto';

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { certificateRenderCache } from '../lib/cache.js';
import { certificateRenderService as puppeteerRenderService } from './certificateRender.js';
import {
  drawClassic,
  CLASSIC_QR_INNER,
} from '../templates/certificates/canvas/classicCanvas.js';
import {
  drawModern,
  MODERN_QR_INNER,
} from '../templates/certificates/canvas/modernCanvas.js';
import {
  drawEditorial,
  EDITORIAL_QR_INNER,
} from '../templates/certificates/canvas/editorialCanvas.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(
  __dirname,
  '..',
  'templates',
  'certificates',
  'fonts'
);

const PAGE_WIDTH = 1600;
const PAGE_HEIGHT = 1131;

const PORTED_TEMPLATES = {
  classic: { draw: drawClassic, qrInner: CLASSIC_QR_INNER },
  modern: { draw: drawModern, qrInner: MODERN_QR_INNER },
  editorial: { draw: drawEditorial, qrInner: EDITORIAL_QR_INNER },
};

// The brand mark centered on every QR code — same file, same URL, for every
// certificate ever rendered, so it's fetched once per process and cached
// rather than once per render the way the QR pattern itself has to be.
let brandMarkPromise = null;
function getBrandMark() {
  if (!brandMarkPromise) {
    brandMarkPromise = (async () => {
      const { loadImage } = await import('@napi-rs/canvas');
      const url = new URL('/favicon.svg', env.publicAppUrl).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch favicon failed: ${res.status}`);
      return loadImage(Buffer.from(await res.arrayBuffer()));
    })().catch((err) => {
      brandMarkPromise = null; // let the next render retry rather than cache a failure
      throw err;
    });
  }
  return brandMarkPromise;
}

/**
 * Draws the QR code + its center brand mark on top of whatever the
 * template's draw function already put down. Kept out of classicCanvas.js
 * (and future per-template modules) because it's the same for every
 * template: decode the QR into an actual image (not the data-URL string the
 * old HTML renderer used — canvas needs real pixels) and drop it, plus the
 * mark, into the box the template tells us about.
 *
 * The mark's size/padding/glow (22px / 3px / 3px white ring) match the
 * original HTML template's .qr-logo exactly — qrInner is already the same
 * ~102px real-module-grid size the original design was tuned against (a
 * 130px outer box minus a 6px border + 8px padding on each side), so the
 * fixed pixel values below are the proven ones, not new guesses.
 */
async function drawQr(ctx, verifyUrl, qrInner) {
  const { loadImage } = await import('@napi-rs/canvas');
  // The brand mark is decorative, not structural — the QR itself is fully
  // scannable without it (errorCorrectionLevel 'H' was chosen specifically
  // so an overlay isn't required for decode). A caught-live bug: this used
  // to be a Promise.all with the QR pattern, so a favicon fetch hiccup
  // (network blip, frontend briefly unreachable) failed the ENTIRE
  // certificate render with a 500 — a real regression versus the old HTML
  // renderer, where a broken <img> just showed a broken-image glyph in that
  // one spot instead of taking down the whole page. Isolated here so the
  // same failure now degrades to "QR without the little logo," not "no
  // certificate at all."
  const [qrPngBuffer, mark] = await Promise.all([
    QRCode.toBuffer(verifyUrl, {
      width: qrInner.size,
      margin: 0,
      errorCorrectionLevel: 'H',
    }),
    getBrandMark().catch((err) => {
      logger.warn('QR brand mark unavailable — drawing QR without it', {
        err,
      });
      return null;
    }),
  ]);
  const qrImage = await loadImage(qrPngBuffer);
  ctx.drawImage(qrImage, qrInner.left, qrInner.top, qrInner.size, qrInner.size);
  if (!mark) return;

  const cx = qrInner.left + qrInner.size / 2;
  const cy = qrInner.top + qrInner.size / 2;
  const markSize = 22;
  const padding = 3;
  const boxHalf = markSize / 2 + padding;

  // The 3px white "glow" ring the CSS gave it via box-shadow, then the
  // white backing square (rounded) the mark itself sits on.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(
    cx - boxHalf - 3,
    cy - boxHalf - 3,
    (boxHalf + 3) * 2,
    (boxHalf + 3) * 2,
    6
  );
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx - boxHalf, cy - boxHalf, boxHalf * 2, boxHalf * 2, 5);
  ctx.fill();
  ctx.drawImage(mark, cx - markSize / 2, cy - markSize / 2, markSize, markSize);
}

const STATUS_LABELS = { revoked: 'REVOKED', expired: 'EXPIRED' };

let stampFontRegistered = false;
function ensureStampFont() {
  if (stampFontRegistered) return;
  // Registered here, independent of whichever template's own ensureFonts()
  // ran — this stamp is drawn identically across all three templates (see
  // below), so it needs a font guaranteed present regardless of which one
  // rendered. Same family+file modern/editorialCanvas.js already register;
  // GlobalFonts is one process-wide registry, so re-registering the same
  // face from here is a harmless no-op if it's already loaded.
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'Inter-ExtraBold.ttf'),
    'Inter'
  );
  stampFontRegistered = true;
}

/**
 * The REVOKED/EXPIRED ribbon — a real correctness requirement, not
 * decoration: shared.js's original renderStatusStamp() doc comment is
 * explicit that "a downloaded document must never look cleaner than what a
 * viewer sees on the public verify page." All three original HTML templates
 * called the exact same shared function with the exact same fixed
 * position/style (their shared 1600x1131 canvas, `top:48px; right:-64px;
 * width:320px; transform:rotate(35deg)`), so this lives here once rather
 * than being duplicated per template — drawn last, after the template body
 * and the QR, so it sits on top of everything (matching the original's
 * z-index:10).
 */
function drawStatusStamp(ctx, status) {
  const label = STATUS_LABELS[status];
  if (!label) return;
  ensureStampFont();

  const boxWidth = 320;
  const boxHeight = 44;
  // right:-64 -> the box's right edge sits 64px past the 1600-wide canvas.
  const centerX = PAGE_WIDTH + 64 - boxWidth / 2;
  const centerY = 48 + boxHeight / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((35 * Math.PI) / 180);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Manual letter-spacing (0.12em -> ~2.4px at 20px): canvas has no native
  // letter-spacing support, same reasoning as fillTextSpaced in the
  // per-template modules.
  const spacing = 2.4;
  const widths = [...label].map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + spacing * (label.length - 1);
  ctx.textAlign = 'left';
  let x = -totalWidth / 2;
  for (let i = 0; i < label.length; i++) {
    ctx.fillText(label[i], x, 1);
    x += widths[i] + spacing;
  }
  ctx.restore();
}

/**
 * @napi-rs/canvas's own `toBuffer('image/png')` measured ~160ms for a
 * 1600x1131 canvas regardless of content — a fixed cost that alone blew the
 * sub-100ms target. sharp's PNG encoder, fed the same raw RGBA pixels via
 * canvas.data(), is dramatically faster — but profiling the actual draw vs.
 * encode split (not assumed) showed drawing itself is essentially free
 * (2-3ms; every template here is a background image + a handful of text/
 * image composites) and PNG encoding is 100% of the cost, scaling steeply
 * with compressionLevel: at the "full" 3200x2262 output, level 6 measured
 * ~209ms (1.44MB), level 3 ~100ms (1.79MB), level 1 ~68ms (3.79MB — bigger
 * than the OLD Puppeteer renderer's own 2.25MB output, a bad trade). Level
 * 3 is the sweet spot: comfortably under the sub-100ms target at every size
 * this service renders, while still landing smaller than the Puppeteer
 * renderer it replaces.
 */
function encodePng(canvas) {
  const raw = canvas.data();
  return sharp(raw, {
    raw: { width: canvas.width, height: canvas.height, channels: 4 },
  })
    .png({ compressionLevel: 3 })
    .toBuffer();
}

/**
 * Cache key for the "base" render (see stampOnto() below for why the status
 * stamp is excluded). `certId` alone is not enough to key on forever:
 * services/certificate.js resolves logoUrl/signatureUrl/signatoryName/
 * signatoryTitle and the template choice LIVE from organizations/courses on
 * every verify() call, not frozen at issuance — an issuer fixing a wrong
 * logo is expected to see it reflected on every certificate they've ever
 * issued, immediately. Folding exactly those live-resolved fields (and
 * nothing else — student name/course/date/certId never change
 * post-issuance; this project's own rule is "edit = revoke + reissue" under
 * a new id) into the key means a branding change naturally produces a
 * different key rather than needing an explicit invalidation hook.
 */
function renderCacheKey(data, size) {
  const branding = [
    data.certificateTemplate,
    data.logoUrl,
    data.signatureUrl,
    data.signatoryName,
    data.signatoryTitle,
  ]
    .map((v) => v ?? '')
    .join('|');
  const hash = crypto
    .createHash('sha256')
    .update(branding)
    .digest('hex')
    .slice(0, 16);
  return `${data.certId}:${size}:${hash}`;
}

/** The expensive part: background load, text layout, QR generation. Cached — see renderCanvasPng() below. */
async function renderCanvasPngBase(data, size) {
  const template = PORTED_TEMPLATES[data.certificateTemplate];
  const scale = size === 'thumb' ? 1 : 2;
  const canvas = createCanvas(PAGE_WIDTH * scale, PAGE_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  await template.draw(ctx, data);
  await drawQr(ctx, data.verifyUrl, template.qrInner);

  return encodePng(canvas);
}

/**
 * The status stamp is deliberately drawn AFTER the cache boundary, never
 * baked into what's cached — a revoke must be instantly accurate with
 * nothing to bust, which caching the stamped output would break (a
 * certificate revoked after its render was cached would otherwise keep
 * showing as valid until the cache entry expired). For the common case (a
 * valid cert) this is a no-op: the cached base is returned as-is, no
 * re-decode/re-encode round trip at all.
 */
async function stampOnto(basePng, status, size) {
  if (!STATUS_LABELS[status]) return basePng;

  const { loadImage } = await import('@napi-rs/canvas');
  const img = await loadImage(basePng);
  const scale = size === 'thumb' ? 1 : 2;
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  drawStatusStamp(ctx, status);
  return encodePng(canvas);
}

async function renderCanvasPng(data, { size = 'full' } = {}) {
  // .wrap() also collapses concurrent misses on the same key into one
  // render (it caches the in-flight promise itself, not just the result) —
  // a burst of near-simultaneous requests for a certificate nobody's viewed
  // yet renders it once, not once per request.
  const basePng = await certificateRenderCache.wrap(
    renderCacheKey(data, size),
    () => renderCanvasPngBase(data, size)
  );
  return stampOnto(basePng, data.status, size);
}

async function renderCanvasPdf(data) {
  const template = PORTED_TEMPLATES[data.certificateTemplate];
  const canvas = createCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const ctx = canvas.getContext('2d');

  await template.draw(ctx, data);
  await drawQr(ctx, data.verifyUrl, template.qrInner);
  drawStatusStamp(ctx, data.status);

  const png = await encodePng(canvas);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const embedded = await pdf.embedPng(png);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });
  return Buffer.from(await pdf.save());
}

function isPorted(template) {
  return Object.prototype.hasOwnProperty.call(PORTED_TEMPLATES, template);
}

function renderPng(data, opts = {}) {
  if (isPorted(data.certificateTemplate)) {
    return renderCanvasPng(data, opts);
  }
  return puppeteerRenderService.renderPng(data, opts);
}

function renderPdf(data) {
  if (isPorted(data.certificateTemplate)) {
    return renderCanvasPdf(data);
  }
  return puppeteerRenderService.renderPdf(data);
}

/**
 * All three templates the DB schema allows (organizations.certificate_template's
 * check constraint: classic/modern/editorial — see db/migrations/0006) are
 * canvas-ported, so the Puppeteer fallback in renderPng()/renderPdf() above
 * is unreachable in normal operation — kept only as a defensive net for a
 * malformed/legacy value slipping through. Eagerly launching a whole browser
 * at startup for a path that should never run would be exactly the kind of
 * wasted cost this rewrite replaced Puppeteer to get rid of, so warmUp() is
 * a genuine no-op: canvas needs no browser, and its own lazy-loaded costs
 * (fonts, background PNGs) are already fast enough on the first real render
 * (memoized module-level promises — see each canvas/*.js template). If the
 * Puppeteer fallback ever IS hit, it pays its own cold-launch cost once,
 * same as this service's behavior before warmUp() existed at all.
 */
function warmUp() {}

export const certificateRenderCanvasService = {
  renderPng,
  renderPdf,
  warmUp,
  // Still delegates for real: if the Puppeteer fallback above was ever
  // exercised, its browser (if launched) still needs a clean shutdown.
  close: puppeteerRenderService.close,
};
