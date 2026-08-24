/**
 * Boot-time environment validation.
 *
 * Every other module imports `env` from here rather than touching
 * `process.env` directly, so a missing or malformed variable fails loudly at
 * startup instead of throwing on the first request that needs it. See
 * `.env.example` for the full list.
 *
 * ── Required-ness depends on NODE_ENV ──
 * The Supabase core (URL + service key) is always required — the app is inert
 * without a database. The blockchain and email variables are OPTIONAL in
 * development so that DB, auth and validation work can proceed before the smart
 * contract is deployed (the contract is a Week-6 dependency; this work is not).
 * When they are absent the affected feature is disabled and a warning is logged
 * at boot. In production every variable is required.
 */
import { z } from 'zod';

const hexKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be 0x followed by 64 hex characters');

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address');

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Comma-separated list of allowed browser origins (CORS + link building).
  FRONTEND_URL: z.string().min(1).default('http://localhost:3000'),

  // ── Supabase core — always required ──
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_KEY: z.string().min(20),

  // ── Optional in dev, enforced for production below ──
  SUPABASE_ANON_KEY: z.string().min(20).optional(),
  // Empty on projects using asymmetric JWT signing keys — auth falls back to
  // JWKS verification in that case. See middleware/auth.js.
  SUPABASE_JWT_SECRET: z.string().default(''),

  ALCHEMY_RPC_URL: z.url().optional(),
  PRIVATE_KEY: hexKey.optional(),
  CONTRACT_ADDRESS: address.optional(),
  CHAIN_ID: z.coerce.number().int().positive().default(80002),

  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).default('Verify <noreply@verify.app>'),

  // ── SMTP (Brevo, or any other relay) — the no-domain-hassle alternative to
  // Resend's default sender ──
  // Resend's shared sender only delivers to the Resend account owner's own
  // address until a domain is verified, which makes it useless for testing the
  // claim flow against real recipients. An SMTP relay authenticated with its own
  // credentials sends as its own verified sender instead, so any recipient gets
  // the mail. Defaults below are Gmail's for backward compatibility; point
  // SMTP_HOST/SMTP_PORT at a different relay (e.g. smtp-relay.brevo.com:587) to
  // use it instead.
  SMTP_HOST: z.string().min(1).default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.email().optional(),
  // Some providers (Gmail app passwords) show this with spaces
  // ("abcd efgh ijkl mnop"); they are presentational and rejected by the SMTP
  // AUTH exchange, so strip them here rather than leaving a login failure to be
  // debugged at send time. Harmless no-op for providers whose credentials never
  // contain spaces (e.g. Brevo's SMTP key).
  SMTP_PASSWORD: z
    .string()
    .transform((v) => v.replace(/\s+/g, ''))
    .pipe(z.string().min(1))
    .optional(),
  // Display name for the From header under SMTP.
  MAIL_FROM_NAME: z.string().min(1).default('Verify'),
  // Real "From" address under SMTP. Gmail forces From to equal SMTP_USER unless
  // it's a verified "send mail as" alias, so that used to be the only option;
  // Brevo and most other relays send from whatever verified sender you give
  // them, independent of the login. Falls back to SMTP_USER when unset, which
  // preserves the old Gmail-only behavior.
  SMTP_FROM_EMAIL: z.email().optional(),

  SENTRY_DSN: z.string().default(''),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

/**
 * Vars only needed once we actually talk to a chain or send mail. In `test` we
 * stub those services, so these placeholders keep the suite runnable without a
 * real private key in the repo (NFR-SEC-01).
 */
const TEST_DEFAULTS = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key-000000000000',
  SUPABASE_ANON_KEY: 'test-anon-key-000000000000000',
  ALCHEMY_RPC_URL: 'https://test.rpc.invalid',
  PRIVATE_KEY: `0x${'1'.repeat(64)}`,
  CONTRACT_ADDRESS: `0x${'a'.repeat(40)}`,
  RESEND_API_KEY: 'test-resend-key',
};

/** Required beyond the Supabase core once running in production. */
const PRODUCTION_REQUIRED = [
  'SUPABASE_ANON_KEY',
  'ALCHEMY_RPC_URL',
  'PRIVATE_KEY',
  'CONTRACT_ADDRESS',
];

/**
 * Which transport `services/email.js` sends through. SMTP wins when its
 * credentials are present, so switching to it is purely additive to .env —
 * nothing has to be deleted, and reverting to Resend is a matter of removing
 * two lines. Returns null when neither is configured, which disables email.
 */
function resolveEmailTransport(parsed) {
  if (parsed.SMTP_USER && parsed.SMTP_PASSWORD) return 'smtp';
  if (parsed.RESEND_API_KEY) return 'resend';
  return null;
}

function load(source = process.env) {
  // Treat empty/whitespace values as absent, so `SUPABASE_ANON_KEY=` in a
  // half-filled .env behaves like "not set" (letting defaults and .optional()
  // apply) rather than failing a min-length check with a confusing message.
  const raw = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    raw[key] = value;
  }

  if (raw.NODE_ENV === 'test') {
    for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
      if (!raw[key]) raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Thrown, not logged — the logger itself depends on this module.
    throw new Error(
      `Invalid backend environment. Fix these and restart:\n${details}\n\n` +
        `See backend/.env.example for the full list.`
    );
  }

  const parsed = result.data;
  const isProduction = parsed.NODE_ENV === 'production';

  const emailTransport = resolveEmailTransport(parsed);

  // In production the optional vars become mandatory — refuse to ship a build
  // that cannot issue certificates or send claim emails. Email is checked by
  // transport rather than by key, since either provider satisfies it.
  if (isProduction) {
    const missing = PRODUCTION_REQUIRED.filter((key) => !parsed[key]);
    if (!emailTransport) {
      missing.push('RESEND_API_KEY (or SMTP_USER + SMTP_PASSWORD)');
    }
    if (missing.length) {
      throw new Error(
        `Missing required production environment variables:\n` +
          missing.map((k) => `  • ${k}`).join('\n')
      );
    }

    /*
     * FRONTEND_URL defaults to http://localhost:3000, and that default is not
     * inert: it becomes `publicAppUrl`, which builds the claim links we email
     * to students and the QR payload printed on certificates. A production
     * deploy that forgets the variable therefore boots perfectly happily and
     * mails out links to a machine the recipient does not have — while CORS
     * simultaneously rejects the real frontend. Both failures are silent and
     * only surface in someone else's inbox, so refuse to start instead.
     */
    const badOrigins = parsed.FRONTEND_URL.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .map((origin) => {
        let url;
        try {
          url = new URL(origin);
        } catch {
          return `${origin} — not a valid absolute URL`;
        }
        if (
          /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(url.hostname)
        ) {
          return `${origin} — points at this machine, not the deployed frontend`;
        }
        if (url.protocol !== 'https:') {
          return `${origin} — must be https in production`;
        }
        return null;
      })
      .filter(Boolean);

    if (badOrigins.length) {
      throw new Error(
        `FRONTEND_URL is not usable in production:\n` +
          badOrigins.map((m) => `  • ${m}`).join('\n') +
          `\n\nSet it to the deployed frontend origin (comma-separate to allow ` +
          `more than one), e.g. FRONTEND_URL=https://verify.example.com`
      );
    }
  }

  const blockchainEnabled = Boolean(
    parsed.ALCHEMY_RPC_URL && parsed.PRIVATE_KEY && parsed.CONTRACT_ADDRESS
  );
  const emailEnabled = emailTransport !== null;

  // Surfaced rather than logged here (no logger yet at this point); server.js
  // prints them at boot so a developer knows which features are inert.
  const warnings = [];
  if (!blockchainEnabled) {
    warnings.push(
      'Blockchain disabled: set ALCHEMY_RPC_URL, PRIVATE_KEY and CONTRACT_ADDRESS to enable issuance/verification against the chain.'
    );
  }
  if (!emailEnabled) {
    warnings.push(
      'Email disabled: set SMTP_USER + SMTP_PASSWORD (Gmail app password), or RESEND_API_KEY, to send claim emails.'
    );
  }
  if (!parsed.SUPABASE_ANON_KEY) {
    warnings.push(
      'SUPABASE_ANON_KEY not set: the RLS-bound anon client is unavailable (the service-role client still works).'
    );
  }

  // Normalise SUPABASE_URL to a bare origin. A very common mistake is pasting
  // the full REST endpoint (…/rest/v1/) or the dashboard URL with a trailing
  // slash — supabase-js then appends its own /rest/v1, producing a doubled path
  // so every query 404s with PGRST125. Reducing to origin makes that harmless.
  let supabaseUrl = parsed.SUPABASE_URL;
  try {
    const origin = new URL(supabaseUrl).origin;
    if (origin !== supabaseUrl.replace(/\/+$/, '')) {
      warnings.push(
        `SUPABASE_URL contained an extra path or trailing slash; using "${origin}". ` +
          `Set SUPABASE_URL="${origin}" in .env to silence this.`
      );
    }
    supabaseUrl = origin;
  } catch {
    // Unreachable: z.url() already guaranteed it parses.
  }

  return Object.freeze({
    ...parsed,
    SUPABASE_URL: supabaseUrl,
    isProduction,
    isTest: parsed.NODE_ENV === 'test',
    blockchainEnabled,
    emailEnabled,
    /** 'smtp' | 'resend' | null — see resolveEmailTransport. */
    emailTransport,
    /**
     * The From header every outbound message uses. Under SMTP this is
     * SMTP_FROM_EMAIL when set, falling back to SMTP_USER — the old
     * Gmail-only behavior, kept as the default since Gmail rewrites any From
     * address that isn't a verified "send mail as" alias back to the login.
     */
    mailFrom:
      emailTransport === 'smtp'
        ? `${parsed.MAIL_FROM_NAME} <${parsed.SMTP_FROM_EMAIL || parsed.SMTP_USER}>`
        : parsed.RESEND_FROM_EMAIL,
    warnings,
    /** Origins allowed by CORS. */
    allowedOrigins: parsed.FRONTEND_URL.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    /** Base URL used to build claim links and QR payloads. */
    publicAppUrl: parsed.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, ''),
    /**
     * True when the project still uses the legacy shared HS256 secret. When
     * false, JWTs are verified against the project's JWKS endpoint.
     */
    usesLegacyJwtSecret: parsed.SUPABASE_JWT_SECRET.length > 0,
  });
}

export const env = load();
export { load as loadEnv };
