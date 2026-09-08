/**
 * "Editorial" template — @napi-rs/canvas renderer.
 *
 * Composites dynamic content onto the pre-baked assets/editorial-bg.png,
 * which contains everything positionally independent of dynamic content:
 * the dark textured background, frame-line + corner brackets, the masthead
 * shell ("Certificate of Completion" — nothing dynamic precedes it in its
 * row), the motif SVG (fully static AND fixed-position — it centers on its
 * own 372px height within `.middle`'s available space independently of the
 * statement block, since align-items:center in a row centers each child by
 * its own size, not the tallest sibling's), and the verify-band panel
 * (gradient background, border, divider, "VERIFIED ON-CHAIN" label, hint
 * text — bottom-anchored via flex-shrink:0, so its position never depends
 * on what's above it, same reasoning as classic's/modern's footers).
 *
 * `.statement` IS vertically centered like modern's (flex:1 row,
 * align-items:center), so its start position is computed from its own
 * total height the same way — see modernCanvas.js's header comment for why.
 *
 * No new fonts needed: editorial's body text is the same Inter already
 * bundled for modern, and its monospace bits (eyebrow, verify-title, labels,
 * cert-id) use the same JetBrains Mono already bundled for cert-id display.
 */
import { GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { fitFontSize, formatDate, monogramFor } from '../shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const ACCENT = '#3FD9C4';
const MUTED = '#8FA6AE';

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
    path.join(FONTS_DIR, 'JetBrainsMono-Regular.ttf'),
    'JetBrains Mono'
  );
  fontsRegistered = true;
}

let backgroundPromise = null;
function getBackground() {
  if (!backgroundPromise) {
    backgroundPromise = loadImage(path.join(ASSETS_DIR, 'editorial-bg.png'));
  }
  return backgroundPromise;
}

/**
 * Anchors measured off a real browser layout of editorial.js's HTML:
 *   masthead.bottom = 179   (statement/motif center below this)
 *   middle           { top:179, height:656 }
 *   verifyBand.top   = 879
 *   qrImage          { top:906, left:119, width:124, height:124 }
 *     -> inner QR content area (padding:10 each side, no border):
 *        { top:916, left:129, width:104, height:104 }
 *   verifyTitle.top  = 930.5  (static "VERIFIED ON-CHAIN", baked in)
 *   certId.top       = 956.5, left:273
 *   sigCell          { right:1481 }, sig-image slot height:58, bottom:971.5
 *   sigRule.top      = 971.5
 *   sigName.top      = 981.5
 */
const MIDDLE_TOP = 179; // == masthead.bottom, the statement/motif cascade starts here
const MIDDLE_HEIGHT = 656;
const STATEMENT_LEFT = 88;
const STATEMENT_MAX_WIDTH = 1000;
const LOGO_SLOT = { top: 78, left: 88, size: 76 };
const QR_OUTER = { top: 906, left: 119, size: 124 };
const QR_INNER = { top: 916, left: 129, size: 104 };
const VERIFY_TEXT_LEFT = 273;
const CERT_ID_TOP = 956.5;
const SIG_RIGHT = 1481;
const SIG_IMAGE_BOTTOM = 971.5;
const SIG_NAME_TOP = 981.5;

/** Shrinks font size (in 1px steps) until `text` fits within `maxWidth`. */
function shrinkToFit(
  ctx,
  text,
  fontBuilder,
  startSize,
  maxWidth,
  minSize = 16
) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = fontBuilder(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

/** Manual letter-spacing: canvas has no universal native support for it. */
function fillTextSpaced(ctx, text, x, y, letterSpacingPx, align = 'left') {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + letterSpacingPx * (text.length - 1);
  let startX = align === 'center' ? x - totalWidth / 2 : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], startX, y);
    startX += widths[i] + letterSpacingPx;
  }
  ctx.textAlign = prevAlign;
}

function drawContain(ctx, img, x, y, w, h, align = 'left') {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  const dx = align === 'right' ? x + (w - dw) : x;
  ctx.drawImage(img, dx, y + (h - dh), dw, dh);
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function drawEditorial(ctx, data) {
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

  const bg = await getBackground();
  ctx.drawImage(bg, 0, 0, 1600, 1131);

  // ── Masthead logo / monogram fallback (left side; position fixed) ──
  if (logoUrl) {
    try {
      const logo = await loadImage(await fetchBuffer(logoUrl));
      // Original: height:64, vertically centered in the masthead row via
      // align-items:center; drop-shadow is the CSS's "safety net" for rare
      // dark-artwork logos — ctx.filter genuinely supports this (verified).
      ctx.save();
      ctx.filter = 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.32))';
      const h = 64;
      const w = Math.min(300, (logo.width / logo.height) * h);
      drawContain(
        ctx,
        logo,
        LOGO_SLOT.left,
        LOGO_SLOT.top + (LOGO_SLOT.size - h) / 2,
        w,
        h
      );
      ctx.restore();
    } catch {
      drawLogoFallback();
    }
  } else {
    drawLogoFallback();
  }
  function drawLogoFallback() {
    const mono = monogramFor(institutionName);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(
      LOGO_SLOT.left,
      LOGO_SLOT.top,
      LOGO_SLOT.size,
      LOGO_SLOT.size,
      8
    );
    ctx.stroke();
    ctx.font = '700 30px Inter';
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      mono,
      LOGO_SLOT.left + LOGO_SLOT.size / 2,
      LOGO_SLOT.top + LOGO_SLOT.size / 2 + 1
    );
  }

  // ── Statement: vertically centered in `.middle`, same technique as
  // modern's — compute total height first, then draw top-down from the
  // computed start. ──
  const nameSize = fitFontSize(studentName, [
    { upTo: 18, size: 116 },
    { upTo: 28, size: 94 },
    { upTo: 40, size: 72 },
    { size: 56 },
  ]);
  const courseSize = fitFontSize(courseName, [
    { upTo: 30, size: 42 },
    { upTo: 52, size: 35 },
    { upTo: 76, size: 29 },
    { size: 24 },
  ]);
  const labelH = 13 * 1.2;
  const nameH = nameSize * 1.05;
  const label2H = 13 * 1.2;
  const courseH = courseSize * 1.25;
  const originH = 19 * 1.2;
  const statementHeight =
    labelH + 14 + nameH + 52 + label2H + 14 + courseH + 30 + 22 + originH;
  let y = MIDDLE_TOP + (MIDDLE_HEIGHT - statementHeight) / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '400 13px "JetBrains Mono"';
  ctx.fillStyle = ACCENT;
  fillTextSpaced(ctx, 'AWARDED TO', STATEMENT_LEFT, y + labelH * 0.8, 3.1);
  y += labelH + 14;

  const fittedNameSize = shrinkToFit(
    ctx,
    studentName,
    (s) => `700 ${s}px Inter`,
    nameSize,
    STATEMENT_MAX_WIDTH,
    28
  );
  ctx.font = `700 ${fittedNameSize}px Inter`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(studentName, STATEMENT_LEFT, y + nameH * 0.82);
  y += nameH + 52;

  ctx.font = '400 13px "JetBrains Mono"';
  ctx.fillStyle = ACCENT;
  fillTextSpaced(
    ctx,
    'FOR SUCCESSFULLY COMPLETING',
    STATEMENT_LEFT,
    y + label2H * 0.8,
    3.1
  );
  y += label2H + 14;

  const fittedCourseSize = shrinkToFit(
    ctx,
    courseName,
    (s) => `600 ${s}px Inter`,
    courseSize,
    STATEMENT_MAX_WIDTH,
    20
  );
  ctx.font = `600 ${fittedCourseSize}px Inter`;
  ctx.fillStyle = '#E6F1F0';
  ctx.fillText(courseName, STATEMENT_LEFT, y + courseH * 0.82);
  y += courseH + 30;

  // origin: "Institution · Date", with a top rule the CSS drew via
  // border-top — padding-top:22 above the rule, text sits below it.
  ctx.strokeStyle = 'rgba(63, 217, 196, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(STATEMENT_LEFT, y);
  ctx.lineTo(STATEMENT_LEFT + STATEMENT_MAX_WIDTH, y);
  ctx.stroke();
  y += 22;
  const originText = `${institutionName}  ·  ${formatDate(completionDate)}`;
  const fittedOriginSize = shrinkToFit(
    ctx,
    originText,
    (s) => `400 ${s}px Inter`,
    19,
    STATEMENT_MAX_WIDTH,
    13
  );
  ctx.font = `400 ${fittedOriginSize}px Inter`;
  ctx.fillStyle = MUTED;
  ctx.fillText(originText, STATEMENT_LEFT, y + originH * 0.8);

  // ── Verify band (fixed position, independent of everything above) ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '400 21px "JetBrains Mono"';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(certId, VERIFY_TEXT_LEFT, CERT_ID_TOP);

  if (signatureUrl) {
    try {
      const sig = await loadImage(await fetchBuffer(signatureUrl));
      // Ink strokes on a transparent/white ground: inverting to white is
      // correct on this dark sheet, same as the original CSS filter.
      ctx.save();
      ctx.filter = 'brightness(0) invert(1)';
      const h = 58;
      const w = Math.min(280, (sig.width / sig.height) * h);
      drawContain(ctx, sig, SIG_RIGHT - w, SIG_IMAGE_BOTTOM - h, w, h, 'right');
      ctx.restore();
    } catch {
      /* no signature drawn — the rule alone still reads fine */
    }
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = '700 17px Inter';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(signatoryName ?? '', SIG_RIGHT, SIG_NAME_TOP);
  ctx.font = '400 13px Inter';
  ctx.fillStyle = MUTED;
  ctx.fillText(signatoryTitle ?? '', SIG_RIGHT, SIG_NAME_TOP + 17 * 1.2 + 2);

  // QR pattern + brand mark are drawn by the caller (certificateRenderCanvas.js) — see QR_INNER above.
}

export const EDITORIAL_QR_INNER = QR_INNER;
export const EDITORIAL_QR_OUTER = QR_OUTER;
