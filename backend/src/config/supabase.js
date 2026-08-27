/**
 * Two Supabase clients, deliberately separated.
 *
 * The broken code this replaces used the service-role client for
 * `signInWithPassword`, which is both unnecessary and dangerous: the
 * service-role key bypasses Row Level Security entirely, so any query written
 * against it is trusted without question.
 *
 *   adminClient — service_role. Bypasses RLS. All application data access goes
 *                 through it, which is why RLS can stay deny-by-default (T-06).
 *                 Never expose its key or its results without an authz check.
 *   anonClient  — anon/public. RLS-bound. For the rare operation that should be
 *                 constrained by the caller's own policies.
 */
import { createClient } from '@supabase/supabase-js';

import { env } from './env.js';
import { logger } from '../lib/logger.js';

/** Server-side clients must not persist or auto-refresh sessions. */
const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

export const adminClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  serverAuthOptions
);

/**
 * The anon client is optional in development (SUPABASE_ANON_KEY may be unset),
 * and nothing uses it yet. Create it lazily so a half-filled .env doesn't crash
 * the whole process at import time — supabase-js throws synchronously on an
 * undefined key. Callers that genuinely need RLS-bound access get a clear error
 * instead of a cryptic constructor failure at boot.
 */
let _anonClient = null;
export function getAnonClient() {
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error(
      'SUPABASE_ANON_KEY is not set: the RLS-bound anon client is unavailable.'
    );
  }
  _anonClient ??= createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    serverAuthOptions
  );
  return _anonClient;
}

/**
 * Client for user-facing auth operations (`signInWithPassword`, `refreshSession`).
 *
 * Prefers the anon key — the correct key for public auth flows. Falls back to
 * the service key when the anon key is unset so login is testable in dev before
 * that value is filled in; the GoTrue auth endpoint accepts either as its
 * apikey. A one-time warning nudges setting the anon key for production.
 */
let _authClient = null;
let _warnedAuthFallback = false;
export function getAuthClient() {
  if (_authClient) return _authClient;
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY;
  if (!env.SUPABASE_ANON_KEY && !_warnedAuthFallback) {
    _warnedAuthFallback = true;
    logger.warn(
      'Auth endpoints are using the service key as a fallback because SUPABASE_ANON_KEY is unset. Set the anon key before production.'
    );
  }
  _authClient = createClient(env.SUPABASE_URL, key, serverAuthOptions);
  return _authClient;
}

/**
 * Supabase returns errors in-band rather than throwing. Wrapping every call
 * keeps that from silently becoming `data = null` three layers up.
 *
 * @template T
 * @param {{ data: T, error: unknown }} result
 * @param {string} context human-readable operation name, used in the message
 * @returns {T}
 */
export function unwrap({ data, error }, context) {
  if (error) {
    const err = new Error(`Supabase ${context} failed: ${error.message}`);
    err.cause = error;
    err.supabaseCode = error.code;
    throw err;
  }
  return data;
}
