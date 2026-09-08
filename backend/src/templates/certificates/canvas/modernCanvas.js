/**
 * "Modern" template — @napi-rs/canvas renderer.
 *
 * Composites dynamic content onto the pre-baked assets/modern-bg.png, which
 * contains everything positionally independent of dynamic content: the teal
 * top band, the masthead shell ("Certificate of Completion" + its
 * border-bottom rule — nothing dynamic precedes them), and the footer shell
 * (all three caption rules/labels, the QR frame, the static verify hint —
 * the footer sits at a fixed y via flex-shrink:0 at the bottom of a column,
 * so it never shifts regardless of what's above it).
 *
 * Unlike classic's top-down cascade, modern's `.statement` block is
 * VERTICALLY CENTERED (flex:1; justify-content:center) in the space between
 * masthead and footer — so its start position depends on its OWN total
 * height, computed here before any drawing happens, then drawn top-down from
 * that computed start. Anchor constants below came from a real Puppeteer
 * layout (getBoundingClientRect()), same as classic's.
 */
import { GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fitFontSize, formatDate, monogramFor } from '../shared.js';
import { loadRemoteImage } from './remoteImage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const ACCENT = '#0F7B6C';
const INK = '#0B0B0C';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'Inter-Regular.ttf'),
    'Inter'
  );
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'Inter-SemiBold.ttf'),
    'Inter'
  );
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Inter-Bold.ttf'), 'Inter');
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'Inter-ExtraBold.ttf'),
    'Inter'
  );
  // Same reliability gap as everywhere else: 'ui-monospace' only resolves if
  // the host happens to have a real monospace font, which Render's
  // container isn't guaranteed to.
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'JetBrainsMono-Regular.ttf'),
    'JetBrains Mono'
  );
  fontsRegistered = true;
}

let backgroundPromise = null;
function getBackground() {
  if (!backgroundPromise) {
    backgroundPromise = loadImage(path.join(ASSETS_DIR, 'modern-bg.png'));
  }
  return backgroundPromise;
}

/**
 * Anchors measured off a real browser layout of modern.js's HTML:
 *   masthead.bottom = 127   (eyebrow + rule; statement centers below this)
 *   statementSlot    { top:127, bottom:829, height:702 }
 *   footer.top       = 829
 *   sigMedia.bottom  = 1001  (869 + f-media's fixed 132px height)
 *   dateMedia.bottom = 1001  (same f-media height, all three cells share it)
 *   qrImage          { top:869, left:1034, width:132, height:132 }
 *     -> inner QR content area (border:3 + padding:8 = 11 inset each side):
 *        { top:880, left:1045, width:110, height:110 }
 *   captionRuleY     = 1015  (mediaBottom + margin-top:14)
 *   labelTop         = 1027  (ruleY + padding-top:12)
 */
const MAIN_LEFT = 96;
const STATEMENT_TOP = 127;
const STATEMENT_HEIGHT = 702;
const SPINE_X = MAIN_LEFT; // statement's own left edge = main's content edge
const TEXT_LEFT = SPINE_X + 4 /* border */ + 48; /* padding-left */
const MEDIA_BOTTOM = 1001;
const LABEL_TOP = 1027;
const QR_OUTER = { top: 869, left: 1034, size: 132 };
const QR_INNER = { top: 880, left: 1045, size: 110 };

/** Shrinks font size (in 1px steps) until `text` fits within `maxWidth`. */
function shrinkToFit(
  ctx,
  text,
  fontBuilder,
  startSize,
  maxWidth,
  minSize = 18
) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = fontBuilder(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawContain(ctx, img, x, y, w, h, align = 'center') {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = align === 'right' ? x + (w - dw) : x + (w - dw) / 2;
  ctx.drawImage(img, dx, y + (h - dh), dw, dh);
}

function drawContainBottomLeft(ctx, img, x, yTop, maxW, maxH) {
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x, yTop + (maxH - dh), dw, dh);
}

export async function drawModern(ctx, data) {
  ensureFonts();
  const {
    studentName,
    courseName,
    institutionName,
    completionDate,
    certId,
    logoUrl,
    signatureUrl,
    signatoryName,
    signatoryTitle,
  } = data;

  // Kicked off before any drawing so the (independent) logo and signature
  // fetches run concurrently rather than one blocking the other — both are
  // memoized by URL (see remoteImage.js), so this also means a burst of
  // first-ever renders for the same organization shares one fetch each.
  const logoPromise = logoUrl
    ? loadRemoteImage(logoUrl).catch(() => null)
    : null;
  const signaturePromise = signatureUrl
    ? loadRemoteImage(signatureUrl).catch(() => null)
    : null;

  const bg = await getBackground();
  ctx.drawImage(bg, 0, 0, 1600, 1131);

  // ── Masthead logo / monogram fallback (position fixed; content dynamic) ──
  const MASTHEAD_RIGHT = 1504;
  const logo = logoPromise ? await logoPromise : null;
  if (logo) {
    drawContain(ctx, logo, MASTHEAD_RIGHT - 340, 80 - 8, 340, 68, 'right');
  } else {
    drawLogoFallback();
  }
  function drawLogoFallback() {
    const w = Math.max(68, 40 + monogramFor(institutionName).length * 20);
    const x = MASTHEAD_RIGHT - w;
    const y = 80 - 4;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 68);
    ctx.font = '800 27px Inter';
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(monogramFor(institutionName), x + w / 2, y + 34 + 1);
  }

  // ── Compute the centered statement block's total height first ──
  const nameSize = fitFontSize(studentName, [
    { upTo: 18, size: 116 },
    { upTo: 28, size: 92 },
    { upTo: 40, size: 70 },
    { size: 55 },
  ]);
  const courseSize = fitFontSize(courseName, [
    { upTo: 30, size: 46 },
    { upTo: 52, size: 38 },
    { upTo: 76, size: 31 },
    { size: 26 },
  ]);
  const ledeH = 21 * 1.2;
  const nameH = nameSize * 1.04;
  const lede2H = 21 * 1.2;
  const courseH = courseSize * 1.22;
  const instH = 22 * 1.2;
  const statementHeight =
    ledeH + 18 + nameH + 46 + lede2H + 10 + courseH + 30 + instH;
  let y = STATEMENT_TOP + (STATEMENT_HEIGHT - statementHeight) / 2;
  const spineTop = y;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '400 21px Inter';
  ctx.fillStyle = '#5C5C61';
  ctx.fillText('This is to certify that', TEXT_LEFT, y + ledeH * 0.78);
  y += ledeH + 18;

  const fittedNameSize = shrinkToFit(
    ctx,
    studentName,
    (s) => `800 ${s}px Inter`,
    nameSize,
    1300 - 52,
    28
  );
  ctx.font = `800 ${fittedNameSize}px Inter`;
  ctx.fillStyle = INK;
  ctx.fillText(studentName, TEXT_LEFT, y + nameH * 0.82);
  y += nameH + 46;

  ctx.font = '400 21px Inter';
  ctx.fillStyle = '#5C5C61';
  ctx.fillText('has successfully completed', TEXT_LEFT, y + lede2H * 0.78);
  y += lede2H + 10;

  const fittedCourseSize = shrinkToFit(
    ctx,
    courseName,
    (s) => `800 ${s}px Inter`,
    courseSize,
    1300 - 52,
    22
  );
  ctx.font = `800 ${fittedCourseSize}px Inter`;
  ctx.fillStyle = INK;
  ctx.fillText(courseName, TEXT_LEFT, y + courseH * 0.82);
  y += courseH + 30;

  const fittedInstSize = shrinkToFit(
    ctx,
    institutionName,
    (s) => `600 ${s}px Inter`,
    22,
    1300 - 52,
    16
  );
  ctx.font = `600 ${fittedInstSize}px Inter`;
  ctx.fillStyle = '#3A3A3F';
  ctx.fillText(institutionName, TEXT_LEFT, y + instH * 0.8);
  const spineBottom = y + instH;

  // The teal spine runs the statement block's full computed height.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(SPINE_X + 2, spineTop);
  ctx.lineTo(SPINE_X + 2, spineBottom);
  ctx.stroke();

  // ── Footer (fixed position, independent of everything above) ──
  const sig = signaturePromise ? await signaturePromise : null;
  if (sig) {
    drawContainBottomLeft(ctx, sig, MAIN_LEFT, MEDIA_BOTTOM - 72, 300, 72);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 19px Inter';
  ctx.fillStyle = INK;
  ctx.fillText(signatoryName ?? '', MAIN_LEFT, LABEL_TOP + 13.2 + 5);
  ctx.font = '400 14px Inter';
  ctx.fillStyle = '#6A6A70';
  ctx.fillText(
    signatoryTitle ?? '',
    MAIN_LEFT,
    LABEL_TOP + 13.2 + 5 + 19 * 1.2 + 3
  );

  ctx.font = '700 19px Inter';
  ctx.fillStyle = INK;
  ctx.fillText(formatDate(completionDate), 600, LABEL_TOP + 13.2 + 5);

  // QR pattern + brand mark are drawn by the caller (certificateRenderCanvas.js) — see QR_INNER above.

  // cert-id sits BELOW the (baked-in) "Certificate ID" label, left-aligned
  // to the cell — not beside the QR, which is on the row above it.
  ctx.font = '400 14px "JetBrains Mono"';
  ctx.fillStyle = INK;
  ctx.fillText(certId, QR_OUTER.left, LABEL_TOP + 11 * 1.2 + 8);
}

export const MODERN_QR_INNER = QR_INNER;
export const MODERN_QR_OUTER = QR_OUTER;
