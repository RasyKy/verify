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
  'RESEND_API_KEY',
];

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

  // In production the optional vars become mandatory — refuse to ship a build
  // that cannot issue certificates or send claim emails.
  if (isProduction) {
    const missing = PRODUCTION_REQUIRED.filter((key) => !parsed[key]);
    if (missing.length) {
      throw new Error(
        `Missing required production environment variables:\n` +
          missing.map((k) => `  • ${k}`).join('\n')
      );
    }
  }

  const blockchainEnabled = Boolean(
    parsed.ALCHEMY_RPC_URL && parsed.PRIVATE_KEY && parsed.CONTRACT_ADDRESS
  );
  const emailEnabled = Boolean(parsed.RESEND_API_KEY);

  // Surfaced rather than logged here (no logger yet at this point); server.js
  // prints them at boot so a developer knows which features are inert.
  const warnings = [];
  if (!blockchainEnabled) {
    warnings.push(
      'Blockchain disabled: set ALCHEMY_RPC_URL, PRIVATE_KEY and CONTRACT_ADDRESS to enable issuance/verification against the chain.'
    );
  }
  if (!emailEnabled) {
    warnings.push('Email disabled: set RESEND_API_KEY to send claim emails.');
  }
  if (!parsed.SUPABASE_ANON_KEY) {
    warnings.push(
      'SUPABASE_ANON_KEY not set: the RLS-bound anon client is unavailable (the service-role client still works).'
    );
  }

  return Object.freeze({
    ...parsed,
    isProduction,
    isTest: parsed.NODE_ENV === 'test',
    blockchainEnabled,
    emailEnabled,
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
