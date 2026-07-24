/**
 * Terminal error handler (NFR-SEC-06) and 404 catch-all.
 *
 * The contract: an `AppError` is a deliberate outcome and its message is shown
 * to the client. Anything else is a bug — it is logged in full and reported to
 * Sentry, but the client only ever sees `INTERNAL_ERROR`. Stack traces,
 * Postgres messages and upstream payloads never cross the boundary.
 *
 * Response shape matches what the frontend already reads — `err.data.message`
 * in CertificateForm.vue and RevokeConfirmModal.vue — so a validation failure
 * surfaces in the toast rather than "Something went wrong".
 */
import { AppError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

/** Mount after all routes: any unmatched path becomes a JSON 404. */
export function notFoundHandler(req, _res, next) {
  next(notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

// `_next` is unused but Express identifies error handlers by arity 4.
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError || err?.expected === true;
  const status = isApp ? (err.status ?? 400) : 500;

  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    status,
    code: err?.code,
    userId: req.user?.id,
    err,
  };

  if (status >= 500) {
    logger.error(err?.message ?? 'Unhandled error', logPayload);
  } else {
    // Expected 4xx: one line, no stack. Not a defect, just a rejected request.
    logger.warn(err?.message ?? 'Request rejected', {
      ...logPayload,
      err: undefined,
    });
  }

  // A client that has already started receiving bytes cannot be given a new
  // status — bail rather than throwing ERR_HTTP_HEADERS_SENT on top.
  if (res.headersSent) return;

  const body = {
    error: {
      code: isApp ? err.code : 'INTERNAL_ERROR',
      message: isApp ? err.message : 'An unexpected error occurred.',
      requestId: req.id,
    },
  };

  if (isApp && err.meta) Object.assign(body.error, err.meta);

  // Duplicated at the top level because the frontend reads `err.data.message`.
  body.message = body.error.message;

  // Stacks in development only, and only for genuine bugs.
  if (!env.isProduction && !isApp && err?.stack) {
    body.error.stack = err.stack.split('\n').slice(0, 6);
  }

  res.status(status).json(body);
}
