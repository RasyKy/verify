/**
 * Puts the one-time code into Supabase Auth's email templates.
 *
 * Run with:
 *   SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates        # report only
 *   SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write
 *
 * ── Why this script exists ──
 *
 * Three of our flows verify a typed code rather than a clicked link:
 * forgot-password.vue (type `recovery`) and claim/[token].vue (type `email`,
 * which is `magic_link` for an existing account and `confirmation` for a new
 * one). Supabase mints a code for all three, but the STOCK templates render
 * only `{{ .ConfirmationURL }}` — so the mail arrives carrying a link and no
 * code, the pin input has nothing that can be typed into it, and the reset is
 * simply impossible. Nothing errors; the flow just dead-ends.
 *
 * The templates are project settings, not code, so they do not travel with the
 * repo and a fresh project starts broken again. This script is the record of
 * what they must contain.
 *
 * ── Why the templates drop the link entirely ──
 *
 * The digits in `{{ .Token }}` and the token in `{{ .ConfirmationURL }}` are
 * the same one-time token. Corporate mail filters and webmail previews fetch
 * links before a human clicks them, and that fetch spends the token — which
 * kills the code the user is at that moment typing. A template offering both
 * is a template where the code randomly stops working. So: code only.
 *
 * Uses an account-level personal access token (Account → Access Tokens) for
 * the same reason apply-migrations.js does — project API keys talk to
 * PostgREST, and this is project configuration, not data.
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const rawUrl = process.env.SUPABASE_URL;
const write = process.argv.includes('--write');
/*
 * Renders the templates to an HTML file and stops, touching no network and
 * needing no credentials. Worth having: the alternative way to see a change to
 * this design is to push it to a live project and make it mail you, which is a
 * slow loop to iterate a layout in — and on the production project, a
 * destructive one.
 */
const preview = process.argv.includes('--preview');

if (!preview && !token) {
  console.error(
    '✗ SUPABASE_ACCESS_TOKEN is not set.\n' +
      '  Create one at https://supabase.com/dashboard/account/tokens\n' +
      '  Then: SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write\n' +
      '  (or run `npm run auth:templates:preview` to just look at the design)'
  );
  process.exit(1);
}
if (!preview && !rawUrl) {
  console.error('✗ SUPABASE_URL is not set in .env');
  process.exit(1);
}

const host = rawUrl ? new URL(rawUrl).host : '';
const projectRef = host.split('.')[0];

if (!preview && !/^[a-z]{20}$/.test(projectRef)) {
  console.error(
    `✗ Could not read a project ref from SUPABASE_URL ("${host}").\n` +
      '  Expected something like https://abcdefghijklmnopqrst.supabase.co'
  );
  process.exit(1);
}

/**
 * Bumped whenever the markup below changes.
 *
 * The old check was "does the template contain {{ .Token }}", which made this
 * script a one-shot: once a project had ANY code-bearing template, a later
 * design change could never be pushed because every template already passed.
 * The marker makes the check "is this template the one this file describes",
 * so a redesign is just a version bump plus a re-run.
 */
const TEMPLATE_VERSION = 'v2';
const MARKER = `<!--verify-email:${TEMPLATE_VERSION}-->`;

/* ── Brand, from frontend/app/assets/css/design-tokens.css ── */
const GREEN = '#0F7B6C'; // --accent
const GREEN_DEEP = '#0A5C52'; // --accent-text
const GREEN_TINT = '#EAF5F3'; // --accent-light
const GREEN_EDGE = '#BDDDD8'; // --color-teal-200
const INK = '#0F1715';
const BODY = '#4A5654';
const MUTED = '#6E7B78';
const HAIRLINE = '#E4EAE8';
const CANVAS = '#F4F7F6';
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

/**
 * Shared chrome for all three code mails.
 *
 * ── Why it looks like this ──
 *
 * Email is not the web. Every rule here is working around a client:
 *
 *   • Tables, not flex/grid. Outlook renders through Word's HTML engine and
 *     ignores modern layout entirely.
 *   • Styles inline. Gmail strips <style> blocks in several contexts, so
 *     anything structural has to survive on its own attribute.
 *   • No images, not even the logo. Clients block remote images by default,
 *     so an image-built header arrives as an empty box for most recipients on
 *     first open — and this is the one mail they cannot afford to misread.
 *     The wordmark is a coloured table cell with a letter in it.
 *   • The gradient carries `bgcolor` and `background-color` alongside
 *     `background-image`. Outlook drops the gradient and keeps the solid.
 *   • `text-indent` on the code offsets the trailing letter-spacing, which
 *     otherwise pushes the digits visibly left of centre.
 *
 * The hidden preheader is the grey line the inbox list shows next to the
 * subject. Without one, clients scrape the first visible text — which here is
 * the wordmark, so every mail would preview as "Verify Verify".
 */
function codeEmail({ preheader, heading, lead, footer }) {
  return `${MARKER}
<div style="margin:0;padding:0;background-color:${CANVAS};">
  <div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="width:100%;max-width:480px;background-color:#FFFFFF;border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;">
          <tr>
            <td bgcolor="${GREEN}" height="5" style="height:5px;line-height:5px;font-size:5px;background-color:${GREEN};background-image:linear-gradient(135deg,${GREEN} 0%,${GREEN_DEEP} 100%);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 34px 28px;font-family:${FONT};">

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="30" height="30" align="center" valign="middle" bgcolor="${GREEN}" style="width:30px;height:30px;background-color:${GREEN};border-radius:8px;color:#FFFFFF;font-family:${FONT};font-size:15px;font-weight:700;line-height:30px;">V</td>
                  <td style="padding-left:9px;font-family:${FONT};font-size:15.5px;font-weight:700;color:${GREEN_DEEP};letter-spacing:-0.01em;">Verify</td>
                </tr>
              </table>

              <h1 style="margin:22px 0 0;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:700;color:${INK};letter-spacing:-0.02em;">${heading}</h1>
              <p style="margin:9px 0 0;font-family:${FONT};font-size:14.5px;line-height:1.6;color:${BODY};">${lead}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td align="center" bgcolor="${GREEN_TINT}" style="background-color:${GREEN_TINT};border:1px solid ${GREEN_EDGE};border-radius:12px;padding:20px 12px;">
                    <div style="font-family:${MONO};font-size:30px;line-height:1.15;font-weight:700;letter-spacing:9px;text-indent:9px;color:${GREEN_DEEP};">{{ .Token }}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:11px 0 0;text-align:center;font-family:${FONT};font-size:12.5px;line-height:1.5;color:${MUTED};">Expires in one hour &middot; can only be used once</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
                <tr><td height="1" style="height:1px;line-height:1px;font-size:1px;background-color:${HAIRLINE};">&nbsp;</td></tr>
              </table>
              <p style="margin:16px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${MUTED};">${footer}</p>

            </td>
          </tr>
        </table>
        <p style="margin:16px auto 0;max-width:480px;font-family:${FONT};font-size:11.5px;line-height:1.5;color:#8B9794;text-align:center;">
          Verify &middot; blockchain-backed certificate verification
        </p>
      </td>
    </tr>
  </table>
</div>`;
}

const IGNORE =
  "If you didn't request this, you can safely ignore this email — nothing has changed and no one can use the code above.";

/**
 * Management API key → what we want in it. Subject keys are patched only when
 * the GET response actually carries them, so a rename upstream degrades to
 * "template updated, subject skipped" rather than a rejected request.
 */
const TEMPLATES = [
  {
    label: 'Reset password  (forgot-password.vue, type: recovery)',
    contentKey: 'mailer_templates_recovery_content',
    subjectKey: 'mailer_subjects_recovery',
    subject: 'Your password reset code',
    content: codeEmail({
      preheader: 'Your password reset code — expires in one hour.',
      heading: 'Reset your password',
      lead: 'Enter this code on the password reset page to choose a new password.',
      footer: IGNORE,
    }),
  },
  {
    label: 'Magic Link      (claim/[token].vue, existing account)',
    contentKey: 'mailer_templates_magic_link_content',
    subjectKey: 'mailer_subjects_magic_link',
    subject: 'Your sign-in code',
    content: codeEmail({
      preheader: 'Your sign-in code — expires in one hour.',
      heading: 'Your sign-in code',
      lead: 'Enter this code to sign in and claim your certificate.',
      footer: IGNORE,
    }),
  },
  {
    label: 'Confirm signup  (claim/[token].vue, new account)',
    contentKey: 'mailer_templates_confirmation_content',
    subjectKey: 'mailer_subjects_confirmation',
    subject: 'Confirm your email',
    content: codeEmail({
      preheader: 'Your confirmation code — expires in one hour.',
      heading: 'Confirm your email',
      lead: 'Enter this code to confirm your email and claim your certificate.',
      footer: IGNORE,
    }),
  },
];

if (preview) {
  // {{ .Token }} is Supabase's placeholder; a browser would render it as
  // literal text and misrepresent the spacing, so stand in a real-length code.
  const SAMPLE = '48213907';
  const out = fileURLToPath(
    new URL('../.auth-email-preview.html', import.meta.url)
  );

  const page = `<!doctype html>
<meta charset="utf-8">
<title>Verify auth emails — ${TEMPLATE_VERSION}</title>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F4F7F6;padding:24px 12px 0;">
  <p style="max-width:480px;margin:0 auto;font-size:12px;color:#6E7B78;">
    Preview only — subjects and per-client rendering are not reproduced here.
  </p>
</div>
${TEMPLATES.map(
  (
    t
  ) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F4F7F6;padding:22px 12px 0;">
  <p style="max-width:480px;margin:0 auto;font-size:12.5px;font-weight:600;color:#0A5C52;">${t.label}</p>
  <p style="max-width:480px;margin:2px auto 0;font-size:12px;color:#6E7B78;">Subject: ${t.subject}</p>
</div>
${t.content.split('{{ .Token }}').join(SAMPLE)}`
).join('\n')}`;

  fs.writeFileSync(out, page);
  console.log(
    `Rendered ${TEMPLATES.length} templates (${TEMPLATE_VERSION}) to:\n  ${out}\n`
  );
  console.log(
    'Open it, then push with:\n  SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write'
  );
  process.exit(0);
}

const API = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const getResponse = await fetch(API, { headers });
if (!getResponse.ok) {
  console.error(
    `✗ Could not read auth config (HTTP ${getResponse.status}).\n` +
      `  ${await getResponse.text()}`
  );
  process.exit(1);
}
const config = await getResponse.json();

console.log(`Project ${projectRef}\n`);

// OTP length is a separate setting and the frontend hardcodes it (OTP_LENGTH
// in useOtp.ts). A mismatch renders a pin input the code cannot fit into.
const otpLength = config.mailer_otp_length;
if (otpLength != null) {
  console.log(
    `Email OTP length : ${otpLength}` +
      (Number(otpLength) === 8
        ? ''
        : '   ← does NOT match OTP_LENGTH = 8 in frontend/app/composables/useOtp.ts')
  );
}
console.log(`Mode             : ${write ? 'WRITE' : 'report only'}\n`);

const patch = {};
for (const t of TEMPLATES) {
  const current = config[t.contentKey];
  const stock = !current;
  const hasToken =
    typeof current === 'string' && current.includes('{{ .Token }}');
  const isCurrent = typeof current === 'string' && current.includes(MARKER);

  console.log(t.label);
  if (isCurrent) {
    console.log(`  ✓ up to date  (${TEMPLATE_VERSION})`);
  } else if (hasToken) {
    // Working, just not this file's design — worth replacing, but say so
    // differently from "broken", because nobody's reset is failing right now.
    console.log(`  ↑ renders the code, but predates ${TEMPLATE_VERSION}`);
  } else {
    console.log(
      '  ✗ NO CODE IN THIS EMAIL' +
        (stock
          ? '  (empty — Supabase is sending its stock link-only template)'
          : '')
    );
  }

  if (isCurrent) continue;
  patch[t.contentKey] = t.content;
  if (t.subjectKey in config) patch[t.subjectKey] = t.subject;
}

if (!Object.keys(patch).length) {
  console.log(`\n✓ Every template is at ${TEMPLATE_VERSION}. Nothing to do.`);
  process.exit(0);
}

if (!write) {
  console.log(
    '\nRe-run with --write to install them:\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write'
  );
  process.exit(1);
}

const patchResponse = await fetch(API, {
  method: 'PATCH',
  headers,
  body: JSON.stringify(patch),
});
if (!patchResponse.ok) {
  console.error(
    `\n✗ Update failed (HTTP ${patchResponse.status}).\n  ${await patchResponse.text()}`
  );
  process.exit(1);
}

console.log(
  `\n✓ Updated ${Object.keys(patch).length} setting(s). Request a new code — ` +
    'codes already sent were minted under the old template and carry no digits.'
);
