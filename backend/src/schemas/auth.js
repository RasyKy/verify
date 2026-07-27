/**
 * Auth request schemas.
 *
 * The backend does not own account creation for issuers (admin creates those)
 * or holders (they sign up during the claim flow, on the frontend). These
 * schemas cover the token operations the backend does expose: login, refresh,
 * and an account-existence check the claim UI uses to branch signup vs login.
 */
import { z } from 'zod';

import { email } from './common.js';

export const loginSchema = z
  .object({
    email,
    // Only a presence/length floor here — Supabase enforces the real policy.
    // Validating too strictly would reject a legitimate existing password.
    password: z.string().min(1, 'Password is required').max(200),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  })
  .strict();

export const accountExistsSchema = z.object({
  email,
});
