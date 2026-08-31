/**
 * "Modern" certificate template — Swiss/Coursera minimalism.
 *
 * White canvas, one teal accent used sparingly, typography carrying the
 * entire hierarchy. No webfonts: Puppeteer's render must never depend on a
 * live network call, so a tight grotesque system stack (Helvetica Neue /
 * Arial) does the work at display weights instead of a fetched font file.
 *
 * ── Three composition rules this template exists to hold ──
 *
 * 1. No dead zones. The statement block is vertically centred in the space
 *    between the masthead and the footer (flex:1 + justify-content:center),
 *    so the whitespace above and below it is symmetric and reads as framing.
 *    Fixed margins instead of centring is what previously left an unowned
 *    void through the middle third.
 *
 * 2. Every footer element shares one baseline. `.f-media` is a fixed-height
 *    box with its contents bottom-aligned, so a 64px signature and a 132px
 *    QR block still end at the same y — which means the text beneath them
 *    starts at the same y too. Previously each cell found its own height and
 *    the three sat at three different levels.
 *
 * 3. Nothing floats. Every rule is attached to the block it belongs to. A
 *    short accent dash sitting in open space reads as a rendering artifact,
 *    not as design.
 *
 * The institution is named once, inside the statement — not repeated in the
 * footer. The footer is signature / date / verification, and nothing else.
 */
import {
  escapeAttr,
  escapeHtml,
  fitFontSize,
  formatDate,
  monogramFor,
  renderStatusStamp,
} from './shared.js';

const ACCENT = '#0F7B6C';
const INK = '#0B0B0C';

export function renderModern(data) {
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
  const monogram = monogramFor(institutionName);

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
    color: ${INK};
    -webkit-font-smoothing: antialiased;
  }
  .cert {
    position: relative;
    width: 1600px;
    height: 1131px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #ffffff;
  }
  /* Full-bleed, so it reads as the sheet's edge rather than a floating bar. */
  .top-band { height: 12px; background: ${ACCENT}; flex-shrink: 0; }

  .main {
    flex: 1;
    padding: 68px 96px 64px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ── Masthead ─────────────────────────────────────────────────────── */
  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 26px;
    border-bottom: 1px solid rgba(11, 11, 12, 0.14);
    flex-shrink: 0;
  }
  .eyebrow {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .logo { height: 68px; max-width: 340px; object-fit: contain; object-position: right center; }
  /*
   * Branding is optional (organizations.logo_url is nullable). An empty
   * masthead corner makes the sheet look unfinished, so the fallback is a
   * monogram chip that occupies the same slot at the same weight.
   */
  .logo-fallback {
    height: 68px;
    min-width: 68px;
    padding: 0 20px;
    border: 2px solid ${ACCENT};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 27px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: ${ACCENT};
  }

  /* ── Statement ────────────────────────────────────────────────────── */
  /*
   * The teal spine runs the full height of the middle region. It is what
   * stops the centred statement from floating in an unowned band: the space
   * above and below the text is now visibly *inside* a column, so it reads
   * as margin rather than as a gap someone forgot to fill. Attached to the
   * block it measures, so it can never look like a stray mark.
   */
  .statement {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
    max-width: 1300px;
    border-left: 4px solid ${ACCENT};
    padding-left: 48px;
    margin-top: 8px;
  }
  .lede {
    font-size: 21px;
    color: #5C5C61;
    letter-spacing: 0.01em;
  }
  .student-name {
    font-size: ${nameSize}px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.04;
    color: ${INK};
    margin-top: 18px;
  }
  .lede-second { margin-top: 46px; }
  .course-name {
    font-size: ${courseSize}px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.22;
    color: ${INK};
    margin-top: 10px;
  }
  .institution {
    font-size: 22px;
    font-weight: 600;
    color: #3A3A3F;
    margin-top: 30px;
  }

  /* ── Footer ───────────────────────────────────────────────────────── */
  /*
   * align-items:flex-start, NOT flex-end. Every cell opens with the same
   * fixed-height .f-media box, so aligning the tops is what puts the
   * caption rules on one line. Bottom-aligning instead lets a cell with an
   * extra caption line (a signatory with a long title) ride upward and
   * drag its rule out of step with the other two — which is exactly the
   * three-different-baselines problem this footer had.
   */
  .footer {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 56px;
    padding-top: 40px;
  }
  /*
   * The shared-baseline mechanism. Fixed height, contents bottom-aligned:
   * a short signature and a tall QR both finish at the same y, so the
   * caption blocks that follow them start level with each other.
   */
  .f-media {
    height: 132px;
    display: flex;
    align-items: flex-end;
  }
  .f-caption {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(11, 11, 12, 0.22);
  }
  .f-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${ACCENT};
  }
  .f-value { font-size: 19px; font-weight: 700; color: ${INK}; margin-top: 5px; }
  .f-sub { font-size: 14px; color: #6A6A70; margin-top: 3px; }

  .cell-signature { width: 330px; }
  .sig-image { height: 72px; max-width: 300px; object-fit: contain; object-position: left bottom; }

  .cell-date { width: 260px; }

  /*
   * Verification is the product's entire claim, so it gets the widest cell,
   * a real label, and a monospace ID at a size a person can actually read
   * off paper and type in — not grey 10px text hidden in a corner.
   */
  .cell-verify { flex: 1; max-width: 470px; }
  .verify-media { display: flex; align-items: flex-end; gap: 20px; }
  .qr-wrap { position: relative; flex-shrink: 0; }
  /*
   * box-sizing:border-box: the 3px border + 8px padding on each side eat
   * into the declared box before any QR pixel is drawn — 132px leaves
   * ~110px of real module grid, enough headroom for the centred mark.
   */
  .qr-image { display: block; width: 132px; height: 132px; border: 3px solid ${INK}; padding: 8px; background: #fff; }
  /*
   * qrDataUrl is generated at errorCorrectionLevel 'H' (~30% correctable)
   * specifically so this overlay stays scannable — verified by decoding a
   * real render back with jsQR, not by eye.
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
    border-radius: 4px;
    padding: 2px;
    box-shadow: 0 0 0 3px #fff;
  }
  .verify-side { padding-bottom: 4px; }
  .verify-hint { font-size: 14px; color: #6A6A70; line-height: 1.45; }
  .cert-id {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    font-size: 14px;
    letter-spacing: 0.02em;
    color: ${INK};
    margin-top: 8px;
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="cert">
    ${renderStatusStamp(status)}
    <div class="top-band"></div>

    <div class="main">
      <div class="masthead">
        <p class="eyebrow">Certificate of Completion</p>
        ${
          logoUrl
            ? `<img class="logo" src="${escapeAttr(logoUrl)}" alt="" />`
            : `<div class="logo-fallback">${escapeHtml(monogram)}</div>`
        }
      </div>

      <div class="statement">
        <p class="lede">This is to certify that</p>
        <h1 class="student-name">${escapeHtml(studentName)}</h1>
        <p class="lede lede-second">has successfully completed</p>
        <p class="course-name">${escapeHtml(courseName)}</p>
        <p class="institution">${escapeHtml(institutionName)}</p>
      </div>

      <div class="footer">
        <div class="cell-signature">
          <div class="f-media">
            ${signatureUrl ? `<img class="sig-image" src="${escapeAttr(signatureUrl)}" alt="" />` : ''}
          </div>
          <div class="f-caption">
            <p class="f-label">Signed by</p>
            <p class="f-value">${escapeHtml(signatoryName ?? '')}</p>
            <p class="f-sub">${escapeHtml(signatoryTitle ?? '')}</p>
          </div>
        </div>

        <div class="cell-date">
          <div class="f-media"></div>
          <div class="f-caption">
            <p class="f-label">Completed</p>
            <p class="f-value">${escapeHtml(formatDate(completionDate))}</p>
          </div>
        </div>

        <div class="cell-verify">
          <div class="f-media verify-media">
            <div class="qr-wrap">
              <img class="qr-image" src="${escapeAttr(qrDataUrl)}" alt="" />
              <img class="qr-logo" src="${escapeAttr(qrLogoUrl)}" alt="" />
            </div>
            <div class="verify-side">
              <p class="verify-hint">Scan to verify this<br />credential on-chain.</p>
            </div>
          </div>
          <div class="f-caption">
            <p class="f-label">Certificate ID</p>
            <p class="cert-id">${escapeHtml(certId)}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
