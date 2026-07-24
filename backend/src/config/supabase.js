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

export const anonClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  serverAuthOptions
);

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
