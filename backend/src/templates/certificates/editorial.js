/**
 * "Editorial" certificate template — tech-forward, matches the product's own
 * blockchain-verification identity.
 *
 * Dark ink background, a faint grid line texture, the brand green as the
 * single accent, monospace accents for the cert ID / blockchain timestamp,
 * and the QR code integrated into a bordered "verification panel" rather
 * than floating decoratively.
 */
import {
  escapeAttr,
  escapeHtml,
  formatDate,
  renderStatusStamp,
} from './shared.js';

const ACCENT = '#3ddc97';
const INK = '#0b0f0e';

export function renderEditorial(data) {
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
    font-family: ui-sans-serif, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: ${INK};
    color: #e8f5ef;
  }
  .cert {
    position: relative;
    width: 1600px;
    height: 1131px;
    overflow: hidden;
    padding: 64px 88px;
    background-image:
      linear-gradient(rgba(61, 220, 151, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(61, 220, 151, 0.05) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 28px;
    border-bottom: 1px solid rgba(61, 220, 151, 0.35);
  }
  .logo { height: 40px; object-fit: contain; filter: brightness(0) invert(1); }
  .eyebrow {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .body-copy { margin-top: 56px; max-width: 1000px; }
  .lede {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 15px;
    color: #8fb5aa;
    margin-bottom: 12px;
  }
  .student-name {
    font-size: 72px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #ffffff;
    margin-bottom: 28px;
  }
  .course-line {
    font-size: 21px;
    color: #cfe8dd;
    line-height: 1.7;
  }
  .course-name { font-weight: 700; color: ${ACCENT}; }
  .bottom-row {
    position: absolute;
    left: 88px;
    right: 88px;
    bottom: 64px;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 40px;
  }
  .sig-block { flex: 1; align-self: flex-end; }
  .sig-image { height: 40px; object-fit: contain; margin-bottom: 8px; filter: brightness(0) invert(1); }
  .sig-line { border-top: 1px solid rgba(232, 245, 239, 0.4); padding-top: 8px; }
  .sig-name { font-size: 14px; font-weight: 700; color: #ffffff; }
  .sig-title { font-size: 11px; color: #8fb5aa; }
  .verify-panel {
    width: 300px;
    border: 1px solid rgba(61, 220, 151, 0.45);
    border-radius: 4px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(61, 220, 151, 0.04);
  }
  .qr-image { width: 76px; height: 76px; background: #fff; padding: 4px; border-radius: 2px; }
  .verify-copy { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; line-height: 1.6; color: #8fb5aa; }
  .verify-copy strong { color: ${ACCENT}; display: block; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
  .meta-line { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 10px; color: #5b7b71; margin-top: 4px; word-break: break-all; }
  .institution-line { font-size: 13px; color: #cfe8dd; margin-top: 8px; }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="top-row">
      <p class="eyebrow">Certificate // Verified Record</p>
      ${logoUrl ? `<img class="logo" src="${escapeAttr(logoUrl)}" alt="" />` : ''}
    </div>

    <div class="body-copy">
      <p class="lede">&gt; this record certifies that</p>
      <h1 class="student-name">${escapeHtml(studentName)}</h1>
      <p class="course-line">
        has completed <span class="course-name">${escapeHtml(courseName)}</span>
      </p>
      <p class="institution-line">${escapeHtml(institutionName)} &middot; ${escapeHtml(formatDate(completionDate))}</p>
    </div>

    <div class="bottom-row">
      <div class="sig-block">
        ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : '<div style="height:40px"></div>'}
        <div class="sig-line">
          <p class="sig-name">${escapeHtml(signatoryName ?? '')}</p>
          <p class="sig-title">${escapeHtml(signatoryTitle ?? '')}</p>
        </div>
      </div>

      <div class="verify-panel">
        <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
        <div class="verify-copy">
          <strong>Scan to verify</strong>
          <span>cert_id:</span>
          <div class="meta-line">${escapeHtml(certId)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
