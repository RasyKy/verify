/**
 * Boot-time environment validation.
 *
 * Every other module imports `env` from here rather than touching
 * `process.env` directly, so a missing or malformed variable fails loudly at
 * startup instead of throwing on the first request that happens to need it.
 * See `.env.example` for the full list.
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

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_KEY: z.string().min(20),
  SUPABASE_ANON_KEY: z.string().min(20),
  // Empty on projects using asymmetric JWT signing keys — auth falls back to
  // JWKS verification in that case. See middleware/auth.js.
  SUPABASE_JWT_SECRET: z.string().default(''),

  ALCHEMY_RPC_URL: z.url(),
  PRIVATE_KEY: hexKey,
  CONTRACT_ADDRESS: address,
  CHAIN_ID: z.coerce.number().int().positive().default(80002),

  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1).default('Verify <noreply@verify.app>'),

  SENTRY_DSN: z.string().default(''),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

/**
 * Vars that only matter once we actually talk to a chain or send mail. In
 * `test` we stub those services, so requiring real values would mean checking
 * a fake private key into the repo — exactly what NFR-SEC-01 forbids.
 */
const RELAXED_IN_TEST = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'ALCHEMY_RPC_URL',
  'PRIVATE_KEY',
  'CONTRACT_ADDRESS',
  'RESEND_API_KEY',
];

const TEST_DEFAULTS = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key-000000000000',
  SUPABASE_ANON_KEY: 'test-anon-key-000000000000000',
  ALCHEMY_RPC_URL: 'https://test.rpc.invalid',
  PRIVATE_KEY: `0x${'1'.repeat(64)}`,
  CONTRACT_ADDRESS: `0x${'a'.repeat(40)}`,
  RESEND_API_KEY: 'test-resend-key',
};

function load(source = process.env) {
  const raw = { ...source };

  if (raw.NODE_ENV === 'test') {
    for (const key of RELAXED_IN_TEST) {
      if (!raw[key]) raw[key] = TEST_DEFAULTS[key];
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

  return Object.freeze({
    ...parsed,
    isProduction: parsed.NODE_ENV === 'production',
    isTest: parsed.NODE_ENV === 'test',
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
