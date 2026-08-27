/**
 * "Modern" certificate template — minimal, geometric, asymmetric.
 *
 * White canvas, a single flat accent color block as the only color note,
 * bold grotesque type left-aligned at scale, generous negative space. No
 * webfonts — a strong system sans stack (Helvetica Neue / Arial Black-style
 * weight) carries the display sizes instead.
 */
import {
  escapeAttr,
  escapeHtml,
  formatDate,
  renderStatusStamp,
} from './shared.js';

const ACCENT = '#0F7B6C';

export function renderModern(data) {
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
    font-family: 'Helvetica Neue', Helvetica, Arial, ui-sans-serif, sans-serif;
    background: #ffffff;
    color: #111111;
  }
  .cert {
    position: relative;
    width: 1600px;
    height: 1131px;
    display: flex;
    overflow: hidden;
  }
  .accent-block {
    width: 88px;
    height: 100%;
    background: ${ACCENT};
    flex-shrink: 0;
  }
  .main {
    flex: 1;
    padding: 76px 96px 56px;
    display: flex;
    flex-direction: column;
  }
  .top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .logo { height: 48px; object-fit: contain; }
  .eyebrow {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .body-copy { margin-top: 64px; max-width: 1180px; }
  .lede {
    font-size: 20px;
    color: #555555;
    margin-bottom: 4px;
  }
  .student-name {
    font-size: 92px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.02;
    color: #0a0a0a;
    margin: 6px 0 28px;
  }
  .course-line {
    font-size: 24px;
    color: #333333;
    line-height: 1.5;
  }
  .course-name { font-weight: 800; color: #0a0a0a; }
  .footer-row {
    margin-top: auto;
    padding-top: 48px;
    border-top: 2px solid #111111;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sig-block { width: 300px; }
  .sig-image { height: 46px; object-fit: contain; margin-bottom: 8px; }
  .sig-line { border-top: 1px solid #111111; padding-top: 8px; }
  .sig-name { font-size: 15px; font-weight: 700; }
  .sig-title { font-size: 12px; color: #666666; }
  .institution-block { text-align: center; width: 340px; }
  .institution-name { font-size: 15px; font-weight: 700; }
  .institution-caption { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 4px; }
  .date-value { font-size: 13px; color: #666666; margin-top: 6px; }
  .qr-block { text-align: right; width: 200px; }
  .qr-image { width: 88px; height: 88px; }
  .qr-caption { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #666666; margin-top: 6px; }
  .cert-id { position: absolute; bottom: 20px; right: 32px; font-size: 10px; color: #999999; }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="accent-block"></div>
    <div class="main">
      <div class="top-row">
        <p class="eyebrow">Certificate&nbsp;of&nbsp;Completion</p>
        ${logoUrl ? `<img class="logo" src="${escapeAttr(logoUrl)}" alt="" />` : ''}
      </div>

      <div class="body-copy">
        <p class="lede">This is to certify that</p>
        <h1 class="student-name">${escapeHtml(studentName)}</h1>
        <p class="course-line">
          has completed <span class="course-name">${escapeHtml(courseName)}</span>
        </p>
      </div>

      <div class="footer-row">
        <div class="sig-block">
          ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : '<div style="height:46px"></div>'}
          <div class="sig-line">
            <p class="sig-name">${escapeHtml(signatoryName ?? '')}</p>
            <p class="sig-title">${escapeHtml(signatoryTitle ?? '')}</p>
          </div>
        </div>

        <div class="institution-block">
          <p class="institution-caption">Issued By</p>
          <p class="institution-name">${escapeHtml(institutionName)}</p>
          <p class="date-value">${escapeHtml(formatDate(completionDate))}</p>
        </div>

        <div class="qr-block">
          <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
          <p class="qr-caption">Verify online</p>
        </div>
      </div>
    </div>
    <p class="cert-id">${escapeHtml(certId)}</p>
  </div>
</body>
</html>`;
}
