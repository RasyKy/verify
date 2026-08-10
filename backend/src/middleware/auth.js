/**
 * Supabase JWT verification and RBAC (FR-AUTH-05, NFR-SEC-03, T-01).
 *
 * The frontend signs in directly against Supabase Auth (see
 * frontend/app/pages/login.vue) and sends the resulting access token as
 * `Authorization: Bearer <jwt>`. This backend never mints tokens — it only
 * verifies them.
 *
 * Verification is LOCAL and CPU-only. The code this replaces called
 * `supabase.auth.getUser(token)` on every request, which is a network
 * round-trip to Supabase per API call: at 50 concurrent verifications
 * (NFR-PERF-03) that adds hundreds of milliseconds to every request and makes
 * the whole API unavailable whenever Supabase's auth endpoint is slow.
 *
 * Two verification modes, chosen by what the project has configured:
 *   • Asymmetric signing keys (current default) — verified against the
 *     project's JWKS endpoint. `createRemoteJWKSet` caches keys in-process and
 *     only re-fetches on key rotation.
 *   • Legacy shared HS256 secret — verified with SUPABASE_JWT_SECRET.
 *
 * ── Why role comes from `app_metadata` ──
 * `user_metadata` is writable by the user themselves via `auth.updateUser()`.
 * Reading a role from it would let any holder promote themselves to admin.
 * `app_metadata` can only be written with the service-role key, i.e. only by
 * this backend. The frontend's use of `user_metadata.institution_name` as a
 * display label is fine; identity decisions must never come from it.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from '../config/env.js';
import { adminClient, unwrap } from '../config/supabase.js';
import { forbidden, unauthorized, upstreamUnavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { TtlCache } from '../lib/cache.js';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  ISSUER: 'issuer',
  HOLDER: 'holder',
});

const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL);

/** Lazily created so `test` runs never attempt a network fetch. */
let jwks;
function getJwks() {
  jwks ??= createRemoteJWKSet(jwksUrl, {
    cacheMaxAge: 10 * 60_000,
    cooldownDuration: 30_000,
  });
  return jwks;
}

const hs256Secret = env.usesLegacyJwtSecret
  ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  : null;

/**
 * Profile lookups are cached briefly. Without this, every authenticated
 * request costs a Supabase round-trip just to learn the caller's org.
 * 60s is short enough that a deactivation takes effect quickly.
 */
const profileCache = new TtlCache({ ttlMs: 60_000, maxEntries: 2000 });

/** `Authorization: Bearer <token>` → token, or null. */
function extractBearer(req) {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

function verifyJwt(token) {
  if (hs256Secret) {
    return jwtVerify(token, hs256Secret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    });
  }
  return jwtVerify(token, getJwks(), { audience: 'authenticated' });
}

/**
 * Loads the caller's profile row — the source of truth for role, organization
 * and account status. The JWT claim is a fast path; this is the authority.
 *
 * Needed because `app_metadata` changes only reach a JWT on its next refresh,
 * so a role change or deactivation can take up to an hour to appear in the
 * token. Reading `profiles` closes that window.
 */
function loadProfile(userId) {
  return profileCache.wrap(userId, async () => {
    const data = unwrap(
      await adminClient
        .from('profiles')
        .select('id, email, role, organization_id, status')
        .eq('id', userId)
        .maybeSingle(),
      'load profile'
    );
    return data ?? null;
  });
}

/** Drops a user's cached profile so a role change applies on the next request. */
export function invalidateProfileCache(userId) {
  profileCache.delete(userId);
}

/**
 * Requires a valid token. Populates `req.user`.
 * Rejects with 401 for a missing/invalid token, 403 for a deactivated account.
 */
export async function requireAuth(req, _res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw unauthorized('Missing bearer token.');
    }

    let payload;
    try {
      ({ payload } = await verifyJwt(token));
    } catch (err) {
      // Distinguish "the token is bad" (401, the client's problem) from "we
      // could not reach the JWKS endpoint" (503, ours). Collapsing both to 401
      // would tell a signed-in user their session expired during an outage.
      if (
        err?.code === 'ERR_JWKS_TIMEOUT' ||
        err?.code === 'ERR_JWKS_NO_MATCHING_KEY' ||
        err?.name === 'JWKSTimeout' ||
        err?.cause?.code === 'ENOTFOUND' ||
        err?.cause?.code === 'ECONNREFUSED'
      ) {
        logger.error('JWKS unavailable — cannot verify tokens', { err });
        throw upstreamUnavailable('Authentication service');
      }
      logger.warn('token verification failed', {
        requestId: req.id,
        reason: err?.code ?? err?.message,
      });
      throw unauthorized('Invalid or expired token.');
    }

    const userId = payload.sub;
    if (!userId) throw unauthorized('Token is missing a subject claim.');

    const profile = await loadProfile(userId);

    if (!profile) {
      // Authenticated with Supabase but no application profile: an account
      // created outside the admin flow. Deny rather than invent a default role.
      logger.warn('authenticated user has no profile row', { userId });
      throw forbidden('No account profile found. Contact your administrator.');
    }

    if (profile.status !== 'active') {
      throw forbidden('This account has been deactivated.');
    }

    req.user = {
      id: userId,
      email: profile.email,
      role: profile.role,
      organizationId: profile.organization_id,
      // Retained for diagnostics when a stale token disagrees with `profiles`.
      claimedRole: payload.app_metadata?.role ?? null,
    };
    // Raw token kept for operations that must act on the session itself, e.g.
    // server-side logout revoking the refresh token.
    req.token = token;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches `req.user` when a token is present but never rejects.
 *
 * For endpoints that are public yet behave differently for a signed-in caller
 * — e.g. a holder viewing their own hidden certificate on the public page.
 */
export function optionalAuth(req, res, next) {
  if (!extractBearer(req)) return next();
  return requireAuth(req, res, (err) => {
    if (err) {
      // A bad token on an optional route means "treat as anonymous", not "fail".
      req.user = undefined;
    }
    next();
  });
}

/**
 * Role gate. Compose after `requireAuth`.
 * @param {...string} allowed roles from ROLES
 */
export function requireRole(...allowed) {
  const permitted = new Set(allowed);
  return function requireRoleMiddleware(req, _res, next) {
    if (!req.user) {
      return next(unauthorized('Authentication required.'));
    }
    if (!permitted.has(req.user.role)) {
      logger.warn('role check failed', {
        requestId: req.id,
        userId: req.user.id,
        role: req.user.role,
        required: [...permitted],
        path: req.originalUrl,
      });
      return next(forbidden('Your role does not permit this action.'));
    }
    next();
  };
}

/**
 * An issuer must belong to an organization before it can act on certificates —
 * otherwise `organization_id` would be null and the row would be unscoped and
 * visible to nobody.
 */
export function requireOrganization(req, _res, next) {
  if (!req.user?.organizationId) {
    return next(forbidden('Your account is not linked to an institution yet.'));
  }
  next();
}
