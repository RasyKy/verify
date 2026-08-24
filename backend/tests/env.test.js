/**
 * config/env.js — the production guards.
 *
 * These exist because both failure modes are SILENT. A production deploy that
 * forgets FRONTEND_URL boots perfectly, serves every request, and quietly mails
 * students claim links pointing at http://localhost:3000 while CORS rejects the
 * real frontend. Nothing errors; it is discovered in someone else's inbox.
 *
 * `loadEnv` takes its source object as a parameter precisely so this can be
 * exercised without touching process.env.
 */
import { loadEnv } from '../src/config/env.js';

/** A minimally complete production environment, valid unless a test breaks it. */
function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://verify.example.com',
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_SERVICE_KEY: 'service-key-0000000000000000',
    SUPABASE_ANON_KEY: 'anon-key-00000000000000000000',
    ALCHEMY_RPC_URL: 'https://polygon-amoy.g.alchemy.com/v2/key',
    PRIVATE_KEY: `0x${'1'.repeat(64)}`,
    CONTRACT_ADDRESS: `0x${'a'.repeat(40)}`,
    RESEND_API_KEY: 'resend-key',
    ...overrides,
  };
}

describe('production FRONTEND_URL guard', () => {
  it('accepts an https origin and exposes it as publicAppUrl', () => {
    const env = loadEnv(productionEnv());
    expect(env.publicAppUrl).toBe('https://verify.example.com');
    expect(env.allowedOrigins).toEqual(['https://verify.example.com']);
  });

  it('refuses to boot when left on the localhost default', () => {
    expect(() =>
      loadEnv(productionEnv({ FRONTEND_URL: 'http://localhost:3000' }))
    ).toThrow(/FRONTEND_URL is not usable in production/);
  });

  it('names the offending origin so the fix is obvious', () => {
    expect(() =>
      loadEnv(productionEnv({ FRONTEND_URL: 'http://127.0.0.1:3000' }))
    ).toThrow(/points at this machine/);
  });

  it('rejects a plain-http public origin', () => {
    expect(() =>
      loadEnv(productionEnv({ FRONTEND_URL: 'http://verify.example.com' }))
    ).toThrow(/must be https in production/);
  });

  it('rejects a value that is not an absolute URL', () => {
    expect(() =>
      loadEnv(productionEnv({ FRONTEND_URL: 'verify.example.com' }))
    ).toThrow(/not a valid absolute URL/);
  });

  it('checks every origin in a comma-separated list, not just the first', () => {
    // The first entry builds claim links, but the rest are the CORS allowlist —
    // a localhost entry slipping in there is still a production misconfiguration.
    expect(() =>
      loadEnv(
        productionEnv({
          FRONTEND_URL: 'https://verify.example.com, http://localhost:3000',
        })
      )
    ).toThrow(/localhost/);
  });

  it('accepts several https origins', () => {
    const env = loadEnv(
      productionEnv({
        FRONTEND_URL: 'https://verify.example.com, https://staging.example.com',
      })
    );
    expect(env.allowedOrigins).toEqual([
      'https://verify.example.com',
      'https://staging.example.com',
    ]);
  });

  it('leaves development alone — localhost is the whole point there', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3000',
      SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
      SUPABASE_SERVICE_KEY: 'service-key-0000000000000000',
    });
    expect(env.publicAppUrl).toBe('http://localhost:3000');
  });
});

describe('production required variables', () => {
  it('still refuses a deploy that cannot reach the chain', () => {
    expect(() =>
      loadEnv(productionEnv({ CONTRACT_ADDRESS: undefined }))
    ).toThrow(/CONTRACT_ADDRESS/);
  });

  it('still refuses a deploy with no email transport', () => {
    expect(() => loadEnv(productionEnv({ RESEND_API_KEY: undefined }))).toThrow(
      /SMTP_USER/
    );
  });
});
