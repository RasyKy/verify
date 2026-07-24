/**
 * Runs before every test file.
 *
 * NODE_ENV=test makes config/env.js substitute harmless placeholders for the
 * Supabase/Alchemy/Resend variables, so the suite runs with no credentials and
 * no real private key is ever committed (NFR-SEC-01).
 */
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'error';
