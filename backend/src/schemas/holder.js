/**
 * Validation for the holder self-service routes (FR-HOLD-04/05/06).
 */
import { z } from 'zod';

import { uuidParam } from './common.js';

export const certIdParamSchema = uuidParam('id');

export const setCertVisibilitySchema = z
  .object({ is_hidden: z.boolean() })
  .strict();

export const setProfileVisibilitySchema = z
  .object({ profile_is_public: z.boolean() })
  .strict();
