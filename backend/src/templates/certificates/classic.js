/**
 * "Classic" certificate template — refined, luxury, traditional.
 *
 * Cream paper, a thin gold-toned double rule border, centered composition,
 * a serif display face for the student's name. No webfonts — Puppeteer's
 * render must never depend on a live network call, so this leans on a
 * strong, widely-available serif stack (Iowan Old Style / Palatino /
 * Georgia) styled with generous letter-spacing rather than fetching a
 * custom font file.
 */
import {
  escapeAttr,
  escapeHtml,
  formatDate,
  renderStatusStamp,
} from './shared.js';

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
      radial-gradient(ellipse at top left, rgba(191, 155, 66, 0.06), transparent 55%),
      radial-gradient(ellipse at bottom right, rgba(191, 155, 66, 0.06), transparent 55%),
      repeating-linear-gradient(0deg, rgba(140, 115, 60, 0.035) 0px, rgba(140, 115, 60, 0.035) 1px, transparent 1px, transparent 3px),
      repeating-linear-gradient(90deg, rgba(140, 115, 60, 0.035) 0px, rgba(140, 115, 60, 0.035) 1px, transparent 1px, transparent 3px);
    background-repeat: no-repeat, no-repeat, repeat, repeat;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 2px solid #bf9b42;
    outline: 1px solid #bf9b42;
    outline-offset: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 72px 100px 56px;
  }
  .logo { height: 96px; object-fit: contain; margin-bottom: 26px; }
  .eyebrow {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #8a6c1f;
    margin-bottom: 20px;
  }
  .headline {
    font-size: 28px;
    letter-spacing: 0.06em;
    color: #3d3320;
    margin-bottom: 34px;
  }
  .student-name {
    font-size: 92px;
    font-style: italic;
    font-weight: 500;
    color: #1f1b10;
    padding-bottom: 24px;
    margin-bottom: 36px;
    border-bottom: 1px solid #bf9b42;
    max-width: 1240px;
  }
  .lede {
    font-size: 20px;
    color: #6b5a30;
    letter-spacing: 0.03em;
    margin-bottom: 16px;
  }
  .course-name-line {
    font-size: 52px;
    font-weight: 700;
    line-height: 1.15;
    color: #2b2417;
    max-width: 1200px;
    margin-bottom: 24px;
  }
  .awarded-label {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 15px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #8a6c1f;
    margin-bottom: 8px;
  }
  .institution-name {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.015em;
    color: #2b2417;
  }
  .ornament {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 64px;
  }
  .ornament-line { width: 140px; height: 1px; background: #bf9b42; }
  .ornament-dot {
    width: 9px;
    height: 9px;
    border: 1px solid #bf9b42;
    transform: rotate(45deg);
    flex-shrink: 0;
  }
  .meta-row {
    margin-top: auto;
    padding-top: 40px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sig-block { text-align: center; width: 300px; }
  .sig-image { height: 68px; object-fit: contain; margin-bottom: 8px; }
  .sig-line { border-top: 1px solid #8a6c1f; padding-top: 12px; }
  .sig-name { font-size: 22px; font-weight: 700; color: #2b2417; }
  .sig-title { font-size: 15px; color: #5c4a22; letter-spacing: 0.03em; margin-top: 3px; }
  .qr-block { text-align: center; width: 300px; }
  .qr-wrap { position: relative; display: inline-block; }
  /*
   * Sized up from the pre-logo 96px: box-sizing:border-box means the 6px
   * border + 8px padding on every side eat into the box before any QR
   * pixel is drawn, so at 96px the actual module grid was only ~68px —
   * too little resolution for a centered logo to sit on without blotting
   * out a disproportionate share of it. 130px leaves ~102px of real QR.
   */
  .qr-image { width: 130px; height: 130px; border: 6px solid #fff; box-shadow: 0 0 0 1px #bf9b42; border-radius: 10px; padding: 8px; background: #fff; }
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
  .qr-caption { font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #7a5c15; margin-top: 10px; }
  .date-block { text-align: center; width: 300px; }
  .date-value { font-size: 22px; font-weight: 700; color: #2b2417; }
  .date-caption { font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; color: #7a5c15; margin-top: 6px; }
  .cert-id { position: absolute; bottom: 20px; right: 32px; font-size: 11px; color: #8a7c54; letter-spacing: 0.04em; }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="frame">
      ${logoUrl ? `<img class="logo" src="${escapeAttr(logoUrl)}" alt="" />` : ''}
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
          ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : '<div style="height:54px"></div>'}
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
    <p class="cert-id">Certificate ID: ${escapeHtml(certId)}</p>
  </div>
</body>
</html>`;
}
