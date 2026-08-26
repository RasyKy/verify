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

// Inline SVG feTurbulence noise, tiled — a data URI so the render never
// depends on a network fetch. Very low alpha (0.05): felt as paper grain,
// not visible as a pattern.
const PAPER_TEXTURE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function renderClassic(data) {
  const {
    studentName,
    courseName,
    institutionName,
    completionDate,
    certId,
    qrDataUrl,
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
    background-image:
      radial-gradient(ellipse at top left, rgba(191, 155, 66, 0.06), transparent 55%),
      radial-gradient(ellipse at bottom right, rgba(191, 155, 66, 0.06), transparent 55%),
      url("${PAPER_TEXTURE}");
    background-repeat: no-repeat, no-repeat, repeat;
    background-size: auto, auto, 180px 180px;
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
    font-size: 15px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #8a6c1f;
    margin-bottom: 18px;
  }
  .headline {
    font-size: 26px;
    letter-spacing: 0.06em;
    color: #3d3320;
    margin-bottom: 34px;
  }
  .student-name {
    font-size: 80px;
    font-style: italic;
    font-weight: 500;
    color: #1f1b10;
    padding-bottom: 22px;
    margin-bottom: 34px;
    border-bottom: 1px solid #bf9b42;
    max-width: 1100px;
  }
  .lede {
    font-size: 19px;
    color: #6b5a30;
    letter-spacing: 0.03em;
    margin-bottom: 14px;
  }
  .course-name-line {
    font-size: 44px;
    font-weight: 700;
    line-height: 1.15;
    color: #2b2417;
    max-width: 1100px;
    margin-bottom: 18px;
  }
  .awarded-line {
    font-size: 20px;
    color: #4a4128;
  }
  .institution-name { font-weight: 700; color: #2b2417; }
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
  .sig-block { text-align: center; width: 280px; }
  .sig-image { height: 54px; object-fit: contain; margin-bottom: 6px; }
  .sig-line { border-top: 1px solid #8a6c1f; padding-top: 10px; }
  .sig-name { font-size: 18px; font-weight: 700; color: #2b2417; }
  .sig-title { font-size: 14px; color: #5c4a22; letter-spacing: 0.03em; margin-top: 2px; }
  .qr-block { text-align: center; width: 280px; }
  .qr-image { width: 96px; height: 96px; border: 6px solid #fff; box-shadow: 0 0 0 1px #bf9b42; border-radius: 10px; padding: 8px; background: #fff; }
  .qr-caption { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #7a5c15; margin-top: 10px; }
  .date-block { text-align: center; width: 280px; }
  .date-value { font-size: 19px; font-weight: 700; color: #2b2417; }
  .date-caption { font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: #7a5c15; margin-top: 5px; }
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
      <p class="awarded-line">awarded by <span class="institution-name">${escapeHtml(institutionName)}</span></p>

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
          <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
          <p class="qr-caption">Verify Online</p>
        </div>
      </div>
    </div>
    <p class="cert-id">Certificate ID: ${escapeHtml(certId)}</p>
  </div>
</body>
</html>`;
}
