/**
 * Shared helpers for the fixed certificate templates (classic/modern/editorial).
 *
 * Every field a template interpolates — studentName, courseName,
 * institutionName, signatoryName, signatoryTitle — is free text an issuer or
 * a certificate holder ultimately influences, and it lands directly in an
 * HTML string handed to page.setContent(). escapeHtml() is not optional:
 * without it a name containing `<`/`&` would corrupt the render at best and
 * inject markup into the Puppeteer page at worst.
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_LABELS = {
  revoked: 'Revoked',
  expired: 'Expired',
};

/**
 * A downloaded document must never look cleaner than what a viewer sees on
 * the public verify page — a revoked or expired certificate gets the same
 * visible flag here, not a pristine-looking file. No-op for 'verified'.
 */
export function renderStatusStamp(status) {
  const label = STATUS_LABELS[status];
  if (!label) return '';
  return `<div style="
    position: absolute;
    top: 48px;
    right: -64px;
    width: 320px;
    padding: 10px 0;
    transform: rotate(35deg);
    background: #b91c1c;
    color: #ffffff;
    text-align: center;
    font-family: ui-sans-serif, Helvetica, Arial, sans-serif;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    z-index: 10;
  ">${escapeHtml(label)}</div>`;
}

/**
 * Only used for `<img>` src attributes (logo/signature/QR), which are
 * either our own base64 data URIs or a Supabase Storage public URL an
 * issuer uploaded through a validated route — never arbitrary user text.
 * Still escaped, since a URL can legally contain `&`.
 */
export function escapeAttr(value) {
  return escapeHtml(value);
}
