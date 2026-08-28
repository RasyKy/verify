/**
 * "Editorial" certificate template — dark, technical, verification-forward.
 *
 * The house style for security/infosec credentials (Hack The Box being the
 * benchmark): a deep navy-charcoal ground, one saturated accent carrying
 * every label and rule, the recipient's name as an unambiguous white hero,
 * and the credential identifier treated as a feature rather than a footnote.
 * For this product that last part is not decoration — on-chain verifiability
 * is the entire claim, so the ID and QR get a full-width band of their own
 * at the foot of the sheet.
 *
 * ── Why #0D141C and not #000 ──
 * Pure black flattens: there is no room left to sit a panel or a divider
 * *above* the ground, so every layer has to be built by lightening, which
 * reads as grey haze. A deep navy-charcoal keeps a usable range in both
 * directions, and prints without the muddy ink-flooding a full-black
 * background causes.
 *
 * ── Texture ──
 * A fine 45° hatch plus one soft accent bloom. Deliberately not graph-paper
 * gridlines: an even orthogonal grid reads as a wireframe or an unstyled
 * debug overlay, and it fights the type. A diagonal hatch at ~3% opacity
 * reads as material.
 *
 * No webfonts — Puppeteer's render must never depend on a live network call.
 */
import {
  escapeAttr,
  escapeHtml,
  fitFontSize,
  formatDate,
  monogramFor,
  renderStatusStamp,
} from './shared.js';

/** Brand teal, brightened for legibility against the dark ground. */
const ACCENT = '#3FD9C4';
const INK = '#0D141C';
const PANEL = '#121C26';
const MUTED = '#8FA6AE';

export function renderEditorial(data) {
  const {
    studentName,
    courseName,
    institutionName,
    completionDate,
    certId,
    qrDataUrl,
    qrLogoUrl,
    logoUrl,
    signatureUrl,
    signatoryName,
    signatoryTitle,
    status,
  } = data;

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
  const monogram = monogramFor(institutionName);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1600px; height: 1131px; }
  body {
    font-family: ui-sans-serif, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: ${INK};
    color: #C9D6DC;
    -webkit-font-smoothing: antialiased;
  }
  .cert {
    position: relative;
    width: 1600px;
    height: 1131px;
    overflow: hidden;
    background-color: ${INK};
    background-image:
      radial-gradient(900px 620px at 88% -8%, rgba(63, 217, 196, 0.10), transparent 70%),
      radial-gradient(760px 520px at 4% 104%, rgba(63, 217, 196, 0.06), transparent 72%),
      repeating-linear-gradient(45deg, rgba(63, 217, 196, 0.032) 0px, rgba(63, 217, 196, 0.032) 1px, transparent 1px, transparent 9px);
  }

  /* Inset hairline frame + corner brackets — geometric, not ornamental. */
  .frame-line {
    position: absolute;
    inset: 34px;
    border: 1px solid rgba(63, 217, 196, 0.16);
    pointer-events: none;
  }
  .bracket {
    position: absolute;
    width: 46px;
    height: 46px;
    border: 2px solid ${ACCENT};
  }
  .bracket.tl { top: 34px; left: 34px; border-right: 0; border-bottom: 0; }
  .bracket.tr { top: 34px; right: 34px; border-left: 0; border-bottom: 0; }
  .bracket.bl { bottom: 34px; left: 34px; border-right: 0; border-top: 0; }
  .bracket.br { bottom: 34px; right: 34px; border-left: 0; border-top: 0; }

  .inner {
    position: relative;
    width: 100%;
    height: 100%;
    padding: 78px 88px 74px;
    display: flex;
    flex-direction: column;
  }

  /* ── Masthead ─────────────────────────────────────────────────────── */
  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(63, 217, 196, 0.28);
    flex-shrink: 0;
  }
  /*
   * The logo sits directly on the dark ground — no plaque, no invert filter.
   *
   * Both alternatives were tried and both are wrong. brightness(0) invert(1)
   * only suits transparent artwork that is dark, and flattens a colour crest
   * to a white silhouette. A white plaque behind the logo renders anything
   * faithfully, but on the transparent PNGs issuers actually upload it paints
   * a white box onto a dark certificate — which is what it did in production.
   *
   * Measured against the real uploads rather than assumed: 7 of 8 have fully
   * transparent backgrounds (corner alpha 0, 22-83% transparent pixels), and
   * 0 of 8 are too dark to read here (mean luminance 123-229 against a #0D141C
   * ground). So direct placement is correct for effectively all real input.
   *
   * drop-shadow, NOT box-shadow, is the safety net for the dark-artwork case
   * that measurement says is rare but possible: drop-shadow follows the
   * image's alpha silhouette and hugs the artwork's outline, where box-shadow
   * would draw a rectangle and reintroduce the very box being removed here.
   */
  .logo {
    height: 64px;
    max-width: 300px;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.32));
  }
  .logo-fallback {
    height: 76px;
    min-width: 76px;
    padding: 0 22px;
    border: 2px solid ${ACCENT};
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: ${ACCENT};
    background: rgba(63, 217, 196, 0.07);
  }
  .eyebrow {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 15px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${ACCENT};
  }

  /* ── Statement ────────────────────────────────────────────────────────
   * A two-column middle: type on the left, the seal motif on the right.
   * Centring a text block alone in this region left the whole right half
   * and a deep band underneath as unowned space. Splitting it gives the
   * region something to hold at both edges.
   */
  .middle {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 60px;
  }
  .statement {
    flex: 1;
    min-width: 0;
    max-width: 1000px;
  }
  /*
   * Concentric rings, a tick ring and a hexagon — a technical seal rather
   * than an ornament. Drawn inline: an external asset would be a network
   * fetch, which the render must never depend on.
   */
  .motif {
    width: 372px;
    height: 372px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .label {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .student-name {
    font-size: ${nameSize}px;
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.05;
    color: #FFFFFF;
    margin-top: 14px;
  }
  .label-second { margin-top: 52px; }
  .course-name {
    font-size: ${courseSize}px;
    font-weight: 600;
    line-height: 1.25;
    color: #E6F1F0;
    margin-top: 14px;
  }
  .origin {
    font-size: 19px;
    color: ${MUTED};
    margin-top: 30px;
    padding-top: 22px;
    border-top: 1px solid rgba(63, 217, 196, 0.22);
  }

  /* ── Verification band ────────────────────────────────────────────────
   * Full width and given real mass. This is both the trust feature and the
   * structural anchor that keeps the lower third from reading as empty.
   */
  .verify-band {
    flex-shrink: 0;
    margin-top: 44px;
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 26px 30px;
    border: 1px solid rgba(63, 217, 196, 0.34);
    border-radius: 10px;
    background: linear-gradient(180deg, ${PANEL} 0%, rgba(13, 20, 28, 0.6) 100%);
  }
  .qr-wrap { position: relative; flex-shrink: 0; }
  /* box-sizing:border-box: a 124px box less 10px padding a side = ~104px of real QR grid. */
  .qr-image { display: block; width: 124px; height: 124px; background: #fff; padding: 10px; border-radius: 6px; }
  /*
   * qrDataUrl is generated at errorCorrectionLevel 'H' (~30% correctable)
   * specifically so this centred mark stays scannable — verified by decoding
   * a real render back with jsQR, not by eye.
   */
  .qr-logo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    object-fit: contain;
    background: #fff;
    border-radius: 4px;
    padding: 2px;
    box-shadow: 0 0 0 3px #fff;
  }
  .verify-main { flex: 1; min-width: 0; }
  .verify-title {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .cert-id {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 21px;
    letter-spacing: 0.01em;
    color: #FFFFFF;
    margin-top: 9px;
    word-break: break-all;
  }
  .verify-hint { font-size: 13px; color: ${MUTED}; margin-top: 8px; }

  .band-divider { width: 1px; align-self: stretch; background: rgba(63, 217, 196, 0.22); flex-shrink: 0; }

  .sig-cell { width: 300px; flex-shrink: 0; text-align: right; }
  /*
   * Signatures are ink strokes on a transparent or white ground, so forcing
   * them white is the one case where inverting is correct on a dark sheet.
   */
  .sig-image { height: 58px; max-width: 280px; object-fit: contain; object-position: right bottom; filter: brightness(0) invert(1); margin-bottom: 8px; }
  .sig-rule { border-top: 1px solid rgba(201, 214, 220, 0.35); padding-top: 9px; }
  .sig-name { font-size: 17px; font-weight: 700; color: #FFFFFF; }
  .sig-title { font-size: 13px; color: ${MUTED}; margin-top: 2px; }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="frame-line" aria-hidden="true"></div>
    <span class="bracket tl" aria-hidden="true"></span>
    <span class="bracket tr" aria-hidden="true"></span>
    <span class="bracket bl" aria-hidden="true"></span>
    <span class="bracket br" aria-hidden="true"></span>

    <div class="inner">
      <div class="masthead">
        ${
          logoUrl
            ? `<img class="logo" src="${escapeAttr(logoUrl)}" alt="" />`
            : `<div class="logo-fallback">${escapeHtml(monogram)}</div>`
        }
        <p class="eyebrow">Certificate of Completion</p>
      </div>

      <div class="middle">
        <div class="statement">
          <p class="label">Awarded to</p>
          <h1 class="student-name">${escapeHtml(studentName)}</h1>
          <p class="label label-second">For successfully completing</p>
          <p class="course-name">${escapeHtml(courseName)}</p>
          <p class="origin">${escapeHtml(institutionName)} &middot; ${escapeHtml(formatDate(completionDate))}</p>
        </div>

        <svg class="motif" viewBox="0 0 400 400" aria-hidden="true">
          <g fill="none" stroke="${ACCENT}">
            <circle cx="200" cy="200" r="186" stroke-opacity="0.13" stroke-width="1" />
            <circle cx="200" cy="200" r="168" stroke-opacity="0.20" stroke-width="7" stroke-dasharray="2 13" />
            <circle cx="200" cy="200" r="138" stroke-opacity="0.15" stroke-width="1" />
            <polygon points="200,104 116.9,152 116.9,248 200,296 283.1,248 283.1,152" stroke-opacity="0.26" stroke-width="1.5" />
            <circle cx="200" cy="200" r="56" stroke-opacity="0.16" stroke-width="1" />
            <path d="M200 14 V64 M200 336 V386 M14 200 H64 M336 200 H386" stroke-opacity="0.22" stroke-width="1.5" />
          </g>
          <circle cx="200" cy="200" r="5" fill="${ACCENT}" fill-opacity="0.35" />
        </svg>
      </div>

      <div class="verify-band">
        <div class="qr-wrap">
          <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
          <img class="qr-logo" src="${escapeAttr(qrLogoUrl)}" alt="" />
        </div>

        <div class="verify-main">
          <p class="verify-title">Verified on-chain</p>
          <p class="cert-id">${escapeHtml(certId)}</p>
          <p class="verify-hint">Scan the code or enter this ID to confirm this credential independently.</p>
        </div>

        <div class="band-divider" aria-hidden="true"></div>

        <div class="sig-cell">
          ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : '<div style="height:58px"></div>'}
          <div class="sig-rule">
            <p class="sig-name">${escapeHtml(signatoryName ?? '')}</p>
            <p class="sig-title">${escapeHtml(signatoryTitle ?? '')}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
