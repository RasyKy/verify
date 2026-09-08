/**
 * "Classic" template — @napi-rs/canvas renderer.
 *
 * Composites dynamic content onto the pre-baked assets/classic-bg.png, which
 * already contains everything whose position never depends on dynamic
 * content: paper texture, gold frame, the empty seal ring, "Certificate of
 * Completion" / "This certifies that" (nothing dynamic precedes them), and
 * the footer skeleton (signature rule, QR frame, static captions) — the
 * footer sits at a FIXED y in the original CSS (`margin-top: auto` inside a
 * flex column) so it never shifts regardless of what's above it.
 *
 * Everything else — student name, course, institution, and everything
 * between them — cascades: each element's y-position depends on the
 * rendered height of the ones before it, so none of it is safe to bake in.
 * It's drawn here instead, top-down, using a running cursor exactly mirroring
 * classic.js's CSS margins — see the coordinates comment block below for
 * where each constant came from (a real Puppeteer layout of this exact
 * template, measured via getBoundingClientRect(), not eyeballed).
 */
import { GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fitFontSize, formatDate, monogramFor } from '../shared.js';
import { loadRemoteImage } from './remoteImage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const GOLD = '#a67f28';
const GOLD_DEEP = '#7d5c11';

let fontsRegistered = false;
/**
 * Three SEPARATE static-weight files, all registered under one family name —
 * not one variable font. Verified empirically, not assumed: @napi-rs/canvas
 * renders a registered variable font at a single fixed default instance
 * regardless of what weight `ctx.font` requests (measureText returned an
 * IDENTICAL width for "400 ...px" and "700 ...px" against one variable
 * file). Two distinct static files under the same family name DID differ.
 * These three are genuine per-weight static instances Google's font service
 * generates on request (fonts.googleapis.com/css2, default curl UA gets
 * .ttf directly) — not the raw variable file relabeled.
 */
function ensureFonts() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'EBGaramond-Regular.ttf'),
    'EB Garamond'
  );
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'EBGaramond-Bold.ttf'),
    'EB Garamond'
  );
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'EBGaramond-Italic500.ttf'),
    'EB Garamond'
  );
  // The cert-id line needs an actually-monospace face — 'ui-monospace' is a
  // generic keyword that only resolves if the host has a real monospace
  // font installed, which Render's container is not guaranteed to (the
  // exact same reliability gap that justified bundling every other font
  // here in the first place).
  GlobalFonts.registerFromPath(
    path.join(FONTS_DIR, 'JetBrainsMono-Regular.ttf'),
    'JetBrains Mono'
  );
  fontsRegistered = true;
}

let backgroundPromise = null;
function getBackground() {
  if (!backgroundPromise) {
    backgroundPromise = loadImage(path.join(ASSETS_DIR, 'classic-bg.png'));
  }
  return backgroundPromise;
}

/**
 * Real anchor points measured off an actual browser layout of classic.js's
 * HTML (Puppeteer + getBoundingClientRect(), not hand-estimated), in the
 * template's native 1600x1131 logical pixel space:
 *
 *   seal            { top:114, left:742, width:116, height:116 } -> center (800,172)
 *   headline.bottom = 340                 (student-name cascade starts here)
 *   sigLine.top     = 950                 (signature rule y)
 *   dateValue.top   = 973
 *   qrImage         { top:862, left:1217, width:130, height:130 }
 *     -> inner QR content area (border:6 + padding:8 = 14 inset each side):
 *        { top:876, left:1231, width:102, height:102 }
 *   certId.top      = 1109                (bottom:22px absolute -> 1131-22)
 */
const CX = 800; // horizontal center of the 1600-wide canvas
const HEADLINE_BOTTOM = 340;
const SIG_LINE_TOP = 950;
const DATE_VALUE_TOP = 973;
const QR_OUTER = { top: 862, left: 1217, size: 130 };
const QR_INNER = { top: 876, left: 1231, size: 102 };
const CERT_ID_TOP = 1109;
const SEAL_CENTER = { x: 800, y: 172 };

/** Manual letter-spacing: canvas has no universal native support for it. */
function fillTextSpaced(ctx, text, centerX, y, letterSpacingPx) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + letterSpacingPx * (text.length - 1);
  let x = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y);
    x += widths[i] + letterSpacingPx;
  }
  ctx.textAlign = prevAlign;
}

/** Shrinks font size (in 1px steps) until `text` fits within `maxWidth`. */
function shrinkToFit(
  ctx,
  text,
  fontBuilder,
  startSize,
  maxWidth,
  minSize = 20
) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = fontBuilder(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/**
 * @param {import('@napi-rs/canvas').SKRSContext2D} ctx
 * @param {object} data same shape certificateRender.js already builds
 * @param {number} scale 1 for thumb, 2 for full (matches the old
 *   deviceScaleFactor convention) — canvas is created at scale*1600 x
 *   scale*1131 by the caller, and ctx.scale(scale, scale) is already applied
 *   before this runs, so all coordinates below stay in logical 1600x1131 space.
 */
export async function drawClassic(ctx, data) {
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

  // ── Seal: institution logo, or a monogram fallback ──
  const logo = logoPromise ? await logoPromise : null;
  if (logo) {
    const size = 78;
    drawContain(
      ctx,
      logo,
      SEAL_CENTER.x - size / 2,
      SEAL_CENTER.y - size / 2,
      size,
      size
    );
  } else {
    drawMonogram();
  }
  function drawMonogram() {
    ctx.font = '700 42px "EB Garamond"';
    ctx.fillStyle = GOLD_DEEP;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      monogramFor(institutionName),
      SEAL_CENTER.x,
      SEAL_CENTER.y + 2
    );
  }

  // ── The cascade: each block's y depends on the ones before it ──
  let y = HEADLINE_BOTTOM;

  // student-name: italic, 500ish weight, line-height 1.1, then a 22px
  // padding + 1px gold rule underneath (the "border-bottom" in the CSS).
  y += 10; // margin-top
  const nameSize = shrinkToFit(
    ctx,
    studentName,
    (s) => `italic 500 ${s}px "EB Garamond"`,
    fitFontSize(studentName, [
      { upTo: 18, size: 96 },
      { upTo: 28, size: 78 },
      { upTo: 40, size: 60 },
      { size: 48 },
    ]),
    1240
  );
  ctx.font = `italic 500 ${nameSize}px "EB Garamond"`;
  ctx.fillStyle = '#1f1b10';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameLineHeight = nameSize * 1.1;
  const nameBaseline = y + nameLineHeight * 0.82; // approximate ascent within the line box
  ctx.fillText(studentName, CX, nameBaseline);
  // The original's border-bottom sits on the <h1> itself, which — centered
  // in a flex column with no explicit width — shrinks to its own content:
  // the rule hugs however wide "studentName" actually rendered, not the
  // 1240px max-width ceiling (that ceiling only ever caps it, never sets it).
  const nameWidth = ctx.measureText(studentName).width;
  const nameBoxBottom = y + nameLineHeight;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const ruleY = nameBoxBottom + 22;
  ctx.moveTo(CX - nameWidth / 2, ruleY);
  ctx.lineTo(CX + nameWidth / 2, ruleY);
  ctx.stroke();
  y = ruleY + 1;

  // lede: "has successfully completed"
  y += 40;
  ctx.font = '20px "EB Garamond"';
  ctx.fillStyle = '#6b5a30';
  fillTextSpaced(ctx, 'has successfully completed', CX, y + 20 * 0.85, 0.6);
  y += 20 * 1.2;

  // course-name-line
  y += 12;
  const courseSize = shrinkToFit(
    ctx,
    courseName,
    (s) => `700 ${s}px "EB Garamond"`,
    fitFontSize(courseName, [
      { upTo: 28, size: 50 },
      { upTo: 48, size: 40 },
      { upTo: 72, size: 33 },
      { size: 28 },
    ]),
    1200
  );
  ctx.font = `700 ${courseSize}px "EB Garamond"`;
  ctx.fillStyle = '#2b2417';
  const courseLineHeight = courseSize * 1.18;
  ctx.fillText(courseName, CX, y + courseLineHeight * 0.82);
  y += courseLineHeight;

  // awarded-label: "AWARDED BY"
  y += 30;
  ctx.font = '700 14px "EB Garamond"';
  ctx.fillStyle = GOLD_DEEP;
  fillTextSpaced(ctx, 'AWARDED BY', CX, y + 14 * 0.85, 4.2);
  y += 14 * 1.3;

  // institution-name
  y += 6;
  const instSize = shrinkToFit(
    ctx,
    institutionName,
    (s) => `700 ${s}px "EB Garamond"`,
    28,
    1100
  );
  ctx.font = `700 ${instSize}px "EB Garamond"`;
  ctx.fillStyle = '#2b2417';
  const instLineHeight = instSize * 1.2;
  ctx.fillText(institutionName, CX, y + instLineHeight * 0.82);
  y += instLineHeight;

  // ornament: line - diamond - line
  y += 40;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CX - 155, y);
  ctx.lineTo(CX - 25, y);
  ctx.moveTo(CX + 25, y);
  ctx.lineTo(CX + 155, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(CX, y);
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-4.5, -4.5, 9, 9);
  ctx.restore();

  // ── Footer (fixed position, independent of everything above) ──
  // Real bug, caught live with an actual uploaded signature (this path was
  // untested until then — earlier verification only used
  // signatureUrl: null): drawContainBottomLeft's `yTop` is the box's TOP,
  // and it bottom-aligns the image WITHIN [yTop, yTop+maxH] — so passing
  // SIG_LINE_TOP-6 as yTop put the image's bottom at SIG_LINE_TOP-6+64,
  // well BELOW the rule, overlapping the signatory name drawn right after
  // it. The box's top must be SIG_LINE_TOP-6-64 so its bottom lands at
  // SIG_LINE_TOP-6, 6px above the rule (the original's margin-bottom:6px
  // on .sig-image).
  const sig = signaturePromise ? await signaturePromise : null;
  if (sig) {
    drawContainBottomLeft(ctx, sig, 158, SIG_LINE_TOP - 6 - 64, 300, 64);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '700 21px "EB Garamond"';
  ctx.fillStyle = '#2b2417';
  ctx.fillText(signatoryName ?? '', 158 + 160, SIG_LINE_TOP + 10);
  ctx.font = '14px "EB Garamond"';
  ctx.fillStyle = '#5c4a22';
  ctx.fillText(signatoryTitle ?? '', 158 + 160, SIG_LINE_TOP + 10 + 21 + 3);

  ctx.font = '700 21px "EB Garamond"';
  ctx.fillStyle = '#2b2417';
  ctx.fillText(formatDate(completionDate), 640 + 160, DATE_VALUE_TOP);

  // QR pattern + brand mark are drawn by the caller (certificateRenderCanvas.js),
  // which already has the QR/logo images decoded — see QR_INNER above for the
  // exact box to draw into.

  ctx.fillStyle = '#6b5a30';
  ctx.textBaseline = 'top';
  const labelText = 'CERTIFICATE ID';
  ctx.font = '700 11px "EB Garamond"';
  const labelWidth = [...labelText].reduce(
    (w, ch) => w + ctx.measureText(ch).width + 1.76,
    0
  );
  ctx.font = '13px "JetBrains Mono"';
  const valueWidth = ctx.measureText(`  ${certId}`).width;
  const totalWidth = labelWidth + valueWidth;
  let cx = CX - totalWidth / 2;
  ctx.textAlign = 'left';
  ctx.font = '700 11px "EB Garamond"';
  ctx.fillStyle = GOLD_DEEP;
  for (const ch of labelText) {
    ctx.fillText(ch, cx, CERT_ID_TOP + 2);
    cx += ctx.measureText(ch).width + 1.76;
  }
  ctx.font = '13px "JetBrains Mono"';
  ctx.fillStyle = '#6b5a30';
  ctx.fillText(`  ${certId}`, cx, CERT_ID_TOP);
}

export const CLASSIC_QR_INNER = QR_INNER;
export const CLASSIC_QR_OUTER = QR_OUTER;

function drawContain(ctx, img, x, y, w, h) {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawContainBottomLeft(ctx, img, x, yTop, maxW, maxH) {
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x, yTop + (maxH - dh), dw, dh);
}
