/**
 * Validation for the holder self-service routes (FR-HOLD-04/05/06) and the
 * public profile they control (FR-HOLD-04).
 */
import { z } from 'zod';

import { uuidParam } from './common.js';

export const certIdParamSchema = uuidParam('id');

/**
 * The public profile's path parameter. A holder id is a UUID for the same
 * reason a certificate id is — the URL is handed out publicly, so the
 * identifier in it must not be enumerable (NFR-SEC-04, T-05).
 */
export const holderIdParamSchema = uuidParam('holderId');

export const setCertVisibilitySchema = z
  .object({ is_hidden: z.boolean() })
  .strict();

export const setProfileVisibilitySchema = z
  .object({ profile_is_public: z.boolean() })
  .strict();
