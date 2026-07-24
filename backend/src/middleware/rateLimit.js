/**
 * Tiered rate limiting (NFR-SEC-05, T-04).
 *
 * One global limit would be wrong in both directions: too loose to protect the
 * claim endpoint from token brute-forcing, too tight for an institution
 * bulk-issuing a cohort. So limits are scoped to what each endpoint risks.
 *
 * Depends on `app.set('trust proxy', 1)` in app.js. Behind Railway's proxy
 * every request arrives from the same socket address, so without that setting
 * all clients share one bucket and the first burst locks everyone out.
 */
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';
import { logger, pseudonymize } from '../lib/logger.js';

/** Shared config. Draft-8 headers let clients back off politely. */
function make({ windowMs, limit, name, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    // Disabled in tests: Supertest hits the app from one address, so a
    // handful of assertions would otherwise trip the limiter.
    skip: () => env.isTest,
    handler: (req, res) => {
      logger.warn('rate limit exceeded', {
        limiter: name,
        requestId: req.id,
        ip: pseudonymize(req.ip ?? ''),
        path: req.originalUrl,
      });
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again shortly.',
          requestId: req.id,
        },
        message: 'Too many requests. Please slow down and try again shortly.',
      });
    },
  });
}

/**
 * Public verification — the only endpoint an anonymous flood can reach at
 * scale (T-04). Generous enough for an employer checking a batch of
 * applicants, tight enough that scraping is impractical.
 */
export const verifyLimiter = make({
  name: 'verify',
  windowMs: 60_000,
  limit: 30,
});

/**
 * Claim acceptance — the tightest limit in the app. A claim token is the sole
 * credential for taking ownership of a certificate (T-02), so brute-forcing it
 * must be hopeless even though the token itself is 256 bits.
 */
export const claimLimiter = make({
  name: 'claim',
  windowMs: 15 * 60_000,
  limit: 5,
});

/**
 * Issuance — keyed per organization rather than per IP, so one institution
 * cannot exhaust the relayer wallet's gas or Resend quota, and a shared campus
 * NAT does not throttle a colleague. Falls back to IP before authentication.
 *
 * `ipKeyGenerator` is used rather than raw `req.ip` because it normalises IPv6
 * addresses to a subnet; express-rate-limit warns if a custom key generator
 * uses the raw value.
 */
export const issuanceLimiter = make({
  name: 'issuance',
  windowMs: 60 * 60_000,
  limit: 200,
  keyGenerator: (req) =>
    req.user?.organizationId
      ? `org:${req.user.organizationId}`
      : ipKeyGenerator(req.ip ?? ''),
});

/** Baseline for every other authenticated route. */
export const apiLimiter = make({
  name: 'api',
  windowMs: 60_000,
  limit: 120,
});
