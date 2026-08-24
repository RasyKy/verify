/**
 * Prints the one-time code for an email address, without sending mail.
 *
 * Run with:
 *   npm run auth:otp -- someone@example.com              # recovery (password reset)
 *   npm run auth:otp -- someone@example.com magiclink    # claim sign-in, existing account
 *   npm run auth:otp -- someone@example.com signup       # claim sign-in, new account
 *
 * ── Why this exists ──
 *
 * The reset and claim pages both ask for a typed code. Supabase mints that code
 * for every recovery/magic-link/confirmation request, but it only reaches the
 * user if the project's email TEMPLATE renders `{{ .Token }}` — and the stock
 * templates render a link instead. Until `npm run auth:templates -- --write`
 * has been run against a project, the code exists and is valid but nothing
 * puts it in front of anyone, so the flow cannot be tested at all.
 *
 * `generateLink` returns exactly what the email would have carried, including
 * `email_otp`, so this unblocks local testing on a project whose templates are
 * still stock. It is also how the 8-digit OTP length in
 * frontend/app/composables/useOtp.ts was verified.
 *
 * ── Two things to know ──
 *
 * 1. This MINTS A NEW CODE and supersedes any outstanding one for that address.
 *    A code already sitting in an inbox stops working the moment this runs.
 * 2. It needs the service_role key, so it is a local development tool. It is
 *    not wired into any route, and printing a live credential is precisely why
 *    it must never be.
 *
 * The real fix for a deployed project is the email templates, not this script.
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */

import { adminClient } from '../src/config/supabase.js';

const [email, rawType = 'recovery'] = process.argv.slice(2);

/** Supabase's generateLink types, named as the frontend refers to them. */
const TYPES = {
  recovery: 'recovery', // forgot-password.vue → verifyOtp({ type: 'recovery' })
  magiclink: 'magiclink', // claim/[token].vue  → verifyOtp({ type: 'email' })
  signup: 'signup', // claim/[token].vue, first-time account
};

if (!email) {
  console.error(
    '✗ Usage: npm run auth:otp -- <email> [recovery|magiclink|signup]\n' +
      '  e.g.  npm run auth:otp -- dara@rupp.edu.kh'
  );
  process.exit(1);
}
if (!(rawType in TYPES)) {
  console.error(
    `✗ Unknown type "${rawType}". One of: ${Object.keys(TYPES).join(', ')}`
  );
  process.exit(1);
}

const { data, error } = await adminClient.auth.admin.generateLink({
  type: TYPES[rawType],
  email,
  // signup is the only type that requires one; it is discarded, because the
  // account it creates goes on to set its own via the reset flow.
  ...(rawType === 'signup' ? { password: `${crypto.randomUUID()}Aa1!` } : {}),
});

if (error) {
  console.error(`✗ ${error.message}`);
  if (/not found/i.test(error.message)) {
    console.error(
      `  No account for ${email}. Recovery and magiclink need an existing user —\n` +
        '  run `npm run db:seed`, or use type "signup" for a brand new address.'
    );
  }
  process.exit(1);
}

const otp = data?.properties?.email_otp;
if (!otp) {
  console.error('✗ Supabase returned no email_otp for that request.');
  process.exit(1);
}

console.log(`\n  ${email}   (${rawType})\n`);
console.log(`      ${otp.split('').join(' ')}\n`);
console.log(
  `  ${otp.length} digits · valid for one hour · supersedes any code already sent`
);
console.log(
  '  Type it into /auth/forgot-password (recovery) or /claim/:token (magiclink).\n'
);
