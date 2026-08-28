/**
 * "Classic" certificate template — refined, luxury, traditional.
 *
 * Cream paper, a thin gold-toned double rule border, centered composition,
 * a serif display face for the student's name. No webfonts — Puppeteer's
 * render must never depend on a live network call, so this leans on a
 * strong, widely-available serif stack (Iowan Old Style / Palatino /
 * Georgia) styled with generous letter-spacing rather than fetching a
 * custom font file.
 *
 * ── The gold ──
 * Antique gold, not brass: #a67f28 for rules and #7d5c11 for small-caps
 * text. An earlier, lighter #bf9b42 read as washed out against the cream
 * ground — at these hairline widths a light gold loses contrast against
 * #faf6ec entirely and the frame reads as a printing defect rather than as
 * a deliberate border.
 *
 * ── Vertical rhythm ──
 * Spacing is grouped, not even. Blocks that belong together (lede + name,
 * "awarded by" + institution) sit tight; the gaps between groups are the
 * only large ones. Evenly-spaced blocks read as drift — the eye cannot tell
 * what belongs with what — which is what this composition previously did.
 */
import {
  escapeAttr,
  escapeHtml,
  fitFontSize,
  formatDate,
  monogramFor,
  renderStatusStamp,
} from './shared.js';

/** Antique gold. See the header note on why this is not lighter. */
const GOLD = '#a67f28';
const GOLD_DEEP = '#7d5c11';

export function renderClassic(data) {
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
    { upTo: 18, size: 96 },
    { upTo: 28, size: 78 },
    { upTo: 40, size: 60 },
    { size: 48 },
  ]);
  const courseSize = fitFontSize(courseName, [
    { upTo: 28, size: 50 },
    { upTo: 48, size: 40 },
    { upTo: 72, size: 33 },
    { size: 28 },
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
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif;
    background: #faf6ec;
    color: #2b2417;
  }
  .cert {
    position: relative;
    width: 1600px;
    height: 1131px;
    padding: 56px;
    overflow: hidden;
    background-color: #faf6ec;
    /*
     * Paper grain as a fine hairline weave rather than organic noise. An
     * earlier feTurbulence-based texture looked fine but ballooned a ~900KB
     * render to 6.2MB: Puppeteer rasterizes the fully-composited page rather
     * than keeping the CSS tile as a tile, and genuinely-random per-pixel
     * noise defeats PNG's deflate compression regardless of how low its
     * opacity is tuned. A repeating-gradient weave is structured/low-entropy
     * instead — it compresses the way a striped pattern does, not like
     * static — while still reading as subtle fiber at this opacity. Confirmed
     * by re-rendering and checking Content-Length, not by eye alone.
     */
    background-image:
      radial-gradient(ellipse at top left, rgba(166, 127, 40, 0.07), transparent 55%),
      radial-gradient(ellipse at bottom right, rgba(166, 127, 40, 0.07), transparent 55%),
      repeating-linear-gradient(0deg, rgba(140, 115, 60, 0.035) 0px, rgba(140, 115, 60, 0.035) 1px, transparent 1px, transparent 3px),
      repeating-linear-gradient(90deg, rgba(140, 115, 60, 0.035) 0px, rgba(140, 115, 60, 0.035) 1px, transparent 1px, transparent 3px);
    background-repeat: no-repeat, no-repeat, repeat, repeat;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 2px solid ${GOLD};
    outline: 1px solid ${GOLD};
    outline-offset: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 100px 48px;
  }

  /* ── Seal ─────────────────────────────────────────────────────────────
   * Always present, in both states: the institution's uploaded logo sits
   * inside the same gold double ring the monogram fallback uses, so the
   * composition's anchor point does not move or vanish depending on
   * whether branding happens to be configured.
   */
  .seal {
    width: 116px;
    height: 116px;
    border-radius: 999px;
    border: 2px solid ${GOLD};
    box-shadow: 0 0 0 5px #faf6ec, 0 0 0 6px rgba(166, 127, 40, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .seal-logo { width: 78px; height: 78px; object-fit: contain; }
  .seal-monogram {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: ${GOLD_DEEP};
    line-height: 1;
    padding-left: 0.04em;
  }

  .eyebrow {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: ${GOLD_DEEP};
    margin-top: 26px;
  }
  /* Tight to the eyebrow above it — one unit, not two. */
  .headline {
    font-size: 26px;
    letter-spacing: 0.06em;
    color: #574a2e;
    margin-top: 30px;
  }
  .student-name {
    font-size: ${nameSize}px;
    font-style: italic;
    font-weight: 500;
    line-height: 1.1;
    color: #1f1b10;
    padding-bottom: 22px;
    margin-top: 10px;
    border-bottom: 1px solid ${GOLD};
    max-width: 1240px;
  }
  /* Group gap — the largest in the composition, and the only one this size. */
  .lede {
    font-size: 20px;
    color: #6b5a30;
    letter-spacing: 0.03em;
    margin-top: 40px;
  }
  .course-name-line {
    font-size: ${courseSize}px;
    font-weight: 700;
    line-height: 1.18;
    color: #2b2417;
    max-width: 1200px;
    margin-top: 12px;
  }
  .awarded-label {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: ${GOLD_DEEP};
    margin-top: 30px;
  }
  .institution-name {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.015em;
    color: #2b2417;
    margin-top: 6px;
    max-width: 1100px;
  }
  .ornament {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 40px;
  }
  .ornament-line { width: 130px; height: 1px; background: ${GOLD}; }
  .ornament-dot {
    width: 9px;
    height: 9px;
    border: 1px solid ${GOLD};
    transform: rotate(45deg);
    flex-shrink: 0;
  }

  .meta-row {
    margin-top: auto;
    padding-top: 36px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sig-block { text-align: center; width: 320px; }
  .sig-image { height: 64px; object-fit: contain; margin-bottom: 6px; }
  .sig-line { border-top: 1px solid ${GOLD_DEEP}; padding-top: 10px; }
  .sig-name { font-size: 21px; font-weight: 700; color: #2b2417; }
  .sig-title { font-size: 14px; color: #5c4a22; letter-spacing: 0.03em; margin-top: 3px; }

  .date-block { text-align: center; width: 320px; }
  .date-value { font-size: 21px; font-weight: 700; color: #2b2417; }
  .date-caption { font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: ${GOLD_DEEP}; margin-top: 6px; }

  .qr-block { text-align: center; width: 320px; }
  .qr-wrap { position: relative; display: inline-block; }
  /*
   * Sized up from the pre-logo 96px: box-sizing:border-box means the 6px
   * border + 8px padding on every side eat into the box before any QR
   * pixel is drawn, so at 96px the actual module grid was only ~68px —
   * too little resolution for a centered logo to sit on without blotting
   * out a disproportionate share of it. 130px leaves ~102px of real QR.
   */
  .qr-image { width: 130px; height: 130px; border: 6px solid #fff; box-shadow: 0 0 0 1px ${GOLD}; border-radius: 10px; padding: 8px; background: #fff; }
  /*
   * The QR is generated at errorCorrectionLevel 'H' (~30% correctable)
   * specifically so this overlay is safe. Verified, not assumed: rendered
   * a real certificate and decoded the QR back with jsQR — at the previous
   * 96px/26px pairing it did NOT decode; at 130px image / 22px logo it does,
   * with margin to spare.
   */
  .qr-logo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    object-fit: contain;
    background: #fff;
    border-radius: 5px;
    padding: 3px;
    box-shadow: 0 0 0 3px #fff;
  }
  .qr-caption { font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: ${GOLD_DEEP}; margin-top: 10px; }
  /*
   * Legible, not a 6px whisper. On-chain verifiability is the product's
   * whole claim, so the identifier a verifier actually types in gets real
   * contrast and a monospace face that survives being read off paper.
   */
  .cert-id {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 22px;
    text-align: center;
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #6b5a30;
  }
  .cert-id span { color: ${GOLD_DEEP}; letter-spacing: 0.16em; text-transform: uppercase; font-size: 11px; }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="frame">
      <div class="seal">
        ${
          logoUrl
            ? `<img class="seal-logo" src="${escapeAttr(logoUrl)}" alt="" />`
            : `<span class="seal-monogram">${escapeHtml(monogram)}</span>`
        }
      </div>

      <p class="eyebrow">Certificate of Completion</p>
      <p class="headline">This certifies that</p>
      <h1 class="student-name">${escapeHtml(studentName)}</h1>

      <p class="lede">has successfully completed</p>
      <p class="course-name-line">${escapeHtml(courseName)}</p>

      <p class="awarded-label">Awarded by</p>
      <p class="institution-name">${escapeHtml(institutionName)}</p>

      <div class="ornament" aria-hidden="true">
        <span class="ornament-line"></span>
        <span class="ornament-dot"></span>
        <span class="ornament-line"></span>
      </div>

      <div class="meta-row">
        <div class="sig-block">
          ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : '<div style="height:64px"></div>'}
          <div class="sig-line">
            <p class="sig-name">${escapeHtml(signatoryName ?? '')}</p>
            <p class="sig-title">${escapeHtml(signatoryTitle ?? '')}</p>
          </div>
        </div>

        <div class="date-block">
          <p class="date-value">${escapeHtml(formatDate(completionDate))}</p>
          <p class="date-caption">Date of Completion</p>
        </div>

        <div class="qr-block">
          <div class="qr-wrap">
            <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
            <img class="qr-logo" src="${escapeAttr(qrLogoUrl)}" alt="" />
          </div>
          <p class="qr-caption">Verify Online</p>
        </div>
      </div>
    </div>
    <p class="cert-id"><span>Certificate ID</span> &nbsp;${escapeHtml(certId)}</p>
  </div>
</body>
</html>`;
}
