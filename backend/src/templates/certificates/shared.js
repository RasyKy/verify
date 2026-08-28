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

/**
 * Up to two initials for the no-logo monogram fallback.
 *
 * Institution branding is optional (organizations.logo_url is nullable), and
 * an empty slot where a seal belongs makes a certificate look unfinished. A
 * monogram is the standard stand-in: it is derived, never stored, so it can
 * never drift out of sync with the institution's actual name.
 *
 * Skips articles/conjunctions so "Royal University of Phnom Penh" reads as
 * "RU", not "RO" — the words a reader would themselves abbreviate away.
 *
 * @param {string} name
 * @returns {string} 1–2 uppercase letters, or '' when there is nothing usable
 */
const MONOGRAM_STOPWORDS = new Set([
  'of',
  'the',
  'and',
  'for',
  'de',
  'du',
  'la',
  'le',
  'at',
  'in',
]);

export function monogramFor(name) {
  if (typeof name !== 'string') return '';
  const words = name
    .trim()
    .split(/[\s\-–—]+/)
    .filter((w) => w.length > 0 && !MONOGRAM_STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return '';
  const letters = words
    .slice(0, 2)
    .map((w) => [...w][0])
    .join('');
  return letters.toUpperCase();
}

/**
 * Picks a font size from length breakpoints.
 *
 * A certificate canvas is a fixed 1600x1131 with no scrollback and no reflow
 * to fall back on, so a long name does not simply wrap — it pushes the footer
 * off the page and silently clips the QR code, which is the one element that
 * must always survive. CSS alone cannot measure text, so the size is chosen
 * here from character count: crude, but deterministic and testable, and it
 * degrades in the right direction (longer input, smaller type).
 *
 * @param {string} text
 * @param {Array<{ upTo?: number, size: number }>} steps ascending by `upTo`;
 *   the final entry omits `upTo` and acts as the floor.
 * @returns {number} px
 */
export function fitFontSize(text, steps) {
  const length = typeof text === 'string' ? text.trim().length : 0;
  for (const step of steps) {
    if (step.upTo === undefined || length <= step.upTo) return step.size;
  }
  return steps[steps.length - 1].size;
}
