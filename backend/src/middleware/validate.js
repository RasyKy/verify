/**
 * Zod request validation (NFR-SEC-06, T-07).
 *
 * Every route validates before any business logic runs, so malformed or
 * hostile input never reaches a query, a hash, or a chain call.
 *
 * Validated output is written to `req.validated.{body,query,params}` rather
 * than back onto the request. This is not stylistic: in Express 5 `req.query`
 * is a getter with no setter, and assigning to it throws
 * "Cannot set property query of #<IncomingMessage> which has only a getter".
 * Handlers must therefore read `req.validated.query`, which has the added
 * benefit of being the coerced, defaulted, trusted copy.
 */
import { validationFailed } from '../lib/errors.js';

/**
 * Flattens Zod issues into `{ fieldName: [messages] }`, which is what a form
 * needs to highlight the offending inputs.
 * @param {import('zod').ZodError} error
 */
function toFieldErrors(error) {
  /** @type {Record<string, string[]>} */
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * @param {import('zod').ZodType} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return function validateMiddleware(req, _res, next) {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      return next(validationFailed(toFieldErrors(result.error)));
    }

    req.validated ??= {};
    req.validated[source] = result.data;
    next();
  };
}

/** Validate several parts of one request. */
export function validateAll(schemas) {
  const stages = Object.entries(schemas).map(([source, schema]) =>
    validate(schema, /** @type {'body'|'query'|'params'} */ (source))
  );
  return function validateAllMiddleware(req, res, next) {
    let i = 0;
    const run = (err) => {
      if (err) return next(err);
      const stage = stages[i++];
      if (!stage) return next();
      stage(req, res, run);
    };
    run();
  };
}
