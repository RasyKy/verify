/**
 * Claim-flow request schemas.
 *
 * The token is opaque from the API's point of view — it's looked up by its
 * sha256 digest, not parsed. Only a length floor/ceiling here to bound abuse;
 * a malformed token should resolve to "not found", not a 400, so the response
 * never tells an attacker whether a guess was well-formed.
 */
import { z } from 'zod';

export const claimTokenParamSchema = z.object({
  token: z.string().min(1).max(128),
});
