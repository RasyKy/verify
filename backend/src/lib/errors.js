/**
 * Typed application errors.
 *
 * Anything thrown as an `AppError` is a deliberate, client-safe outcome: the
 * error handler forwards its `code` and `message` verbatim. Anything else is
 * treated as a bug and collapsed to a generic 500, so a stack trace or a
 * database message can never reach the client (NFR-SEC-06).
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code stable machine-readable code, e.g. 'CERT_NOT_FOUND'
   * @param {string} message safe to show a user — assume it will be
   * @param {object} [meta] extra fields for the response body (e.g. field errors)
   */
  constructor(status, code, message, meta) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.meta = meta;
    this.expected = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message, meta) =>
  new AppError(400, 'BAD_REQUEST', message, meta);

export const validationFailed = (fieldErrors) =>
  new AppError(422, 'VALIDATION_FAILED', 'Request validation failed.', {
    fieldErrors,
  });

export const unauthorized = (message = 'Authentication required.') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const forbidden = (
  message = 'You do not have access to this resource.'
) => new AppError(403, 'FORBIDDEN', message);

/**
 * 403 with its own code, not a plain `forbidden`.
 *
 * "Your role does not permit this" and "your account is switched off" call for
 * different handling in the browser: the second one must end the session, or
 * the deactivated user keeps a live Supabase session that bounces them between
 * /login and a portal with nothing said. The client keys off the code, not the
 * wording (see frontend/app/composables/useApi.ts).
 */
export const accountDeactivated = (
  message = 'This account has been deactivated.'
) => new AppError(403, 'ACCOUNT_DEACTIVATED', message);

export const notFound = (message = 'Resource not found.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message, meta) =>
  new AppError(409, 'CONFLICT', message, meta);

export const tooManyRequests = (message = 'Too many requests.') =>
  new AppError(429, 'RATE_LIMITED', message);

/**
 * 503, not 500 — and deliberately distinct from "certificate not found".
 *
 * If Alchemy or Supabase is unreachable we must never render that as an
 * invalid certificate: telling an employer a genuine credential is fake is far
 * worse than admitting the service is briefly down (SRS §1.5, Availability).
 */
export const upstreamUnavailable = (service, message) =>
  new AppError(
    503,
    'UPSTREAM_UNAVAILABLE',
    message ?? `${service} is temporarily unavailable. Please try again.`,
    { service }
  );
