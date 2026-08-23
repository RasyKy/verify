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

const token = process.env.SUPABASE_ACCESS_TOKEN;
const rawUrl = process.env.SUPABASE_URL;
const write = process.argv.includes('--write');

if (!token) {
  console.error(
    '✗ SUPABASE_ACCESS_TOKEN is not set.\n' +
      '  Create one at https://supabase.com/dashboard/account/tokens\n' +
      '  Then: SUPABASE_ACCESS_TOKEN=sbp_… npm run auth:templates -- --write'
  );
  process.exit(1);
}
if (!rawUrl) {
  console.error('✗ SUPABASE_URL is not set in .env');
  process.exit(1);
}

const host = new URL(rawUrl).host;
const projectRef = host.split('.')[0];

if (!/^[a-z]{20}$/.test(projectRef)) {
  console.error(
    `✗ Could not read a project ref from SUPABASE_URL ("${host}").\n` +
      '  Expected something like https://abcdefghijklmnopqrst.supabase.co'
  );
  process.exit(1);
}

/** Shared chrome, so the three mails look like the ones services/email.js sends. */
function codeEmail({ heading, lead, footer }) {
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#111827">
  <h1 style="font-size:18px;font-weight:600">${heading}</h1>
  <p style="font-size:14px;line-height:1.6;color:#374151">${lead}</p>
  <p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#0d9488;margin:26px 0">{{ .Token }}</p>
  <p style="font-size:12px;color:#6b7280;line-height:1.6">${footer}</p>
</div>`;
}

const IGNORE =
  "If you didn't request this, you can safely ignore this email — nothing has changed.";

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
      heading: 'Reset your password',
      lead: 'Enter this code on the password reset page to choose a new password.',
      footer: `This code expires in one hour and can only be used once. ${IGNORE}`,
    }),
  },
  {
    label: 'Magic Link      (claim/[token].vue, existing account)',
    contentKey: 'mailer_templates_magic_link_content',
    subjectKey: 'mailer_subjects_magic_link',
    subject: 'Your sign-in code',
    content: codeEmail({
      heading: 'Your sign-in code',
      lead: 'Enter this code to sign in and claim your certificate.',
      footer: `This code expires in one hour and can only be used once. ${IGNORE}`,
    }),
  },
  {
    label: 'Confirm signup  (claim/[token].vue, new account)',
    contentKey: 'mailer_templates_confirmation_content',
    subjectKey: 'mailer_subjects_confirmation',
    subject: 'Confirm your email',
    content: codeEmail({
      heading: 'Confirm your email',
      lead: 'Enter this code to confirm your email and claim your certificate.',
      footer: `This code expires in one hour and can only be used once. ${IGNORE}`,
    }),
  },
];

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
  const hasToken =
    typeof current === 'string' && current.includes('{{ .Token }}');
  const stock = !current;

  console.log(t.label);
  console.log(
    `  ${hasToken ? '✓ renders {{ .Token }}' : '✗ NO CODE IN THIS EMAIL'}` +
      (stock
        ? '  (empty — Supabase is sending its stock link-only template)'
        : '')
  );

  if (hasToken) continue;
  patch[t.contentKey] = t.content;
  if (t.subjectKey in config) patch[t.subjectKey] = t.subject;
}

if (!Object.keys(patch).length) {
  console.log('\n✓ Every template already carries the code. Nothing to do.');
  process.exit(0);
}

if (!write) {
  console.log(
    '\nRe-run with --write to install the code-bearing templates:\n' +
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
