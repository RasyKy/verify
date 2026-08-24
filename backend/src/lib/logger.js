/**
 * Winston logger with PII redaction (NFR-SEC-02, T-06).
 *
 * The whole design works to keep student names and emails off-chain and behind
 * RLS — and then logs are the one place that quietly writes them to disk in
 * plaintext. Redaction is applied as a format so it cannot be forgotten at a
 * call site: every logger in the app goes through it.
 */
import crypto from 'node:crypto';

import winston from 'winston';

import { env } from '../config/env.js';

/** Keys whose values never appear in logs, at any nesting depth. */
const REDACT_KEYS = new Set([
  'student_name',
  'studentName',
  'student_email',
  'studentEmail',
  'full_name',
  'fullName',
  'email',
  'password',
  'token',
  'claimToken',
  'claim_token',
  'authorization',
  'privateKey',
  'PRIVATE_KEY',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'serviceKey',
]);

/**
 * A stable, non-reversible tag for correlating log lines about the same person
 * without storing who they are.
 * @param {string} value
 */
export function pseudonymize(value) {
  if (typeof value !== 'string' || value.length === 0) return '[redacted]';
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

function redact(value, depth = 0) {
  if (depth > 8 || value == null) return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (REDACT_KEYS.has(key)) {
        // Emails keep a pseudonym so support can still correlate reports.
        out[key] =
          key.toLowerCase().includes('email') && typeof val === 'string'
            ? pseudonymize(val)
            : '[redacted]';
      } else {
        out[key] = redact(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

/**
 * Redacts the info object IN PLACE.
 *
 * It must not be rebuilt: winston carries the level and raw message on the
 * symbol keys `Symbol.for('level')` / `Symbol.for('message')`, and
 * `Object.entries` copies only string keys. Returning a fresh object silently
 * drops them, after which `format.colorize()` looks up `allColors[undefined]`
 * and throws "colors[...] is not a function" on the first log line.
 */
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (REDACT_KEYS.has(key)) {
      info[key] =
        key.toLowerCase().includes('email') && typeof info[key] === 'string'
          ? pseudonymize(info[key])
          : '[redacted]';
    } else {
      info[key] = redact(info[key], 1);
    }
  }
  return info;
});

const devFormat = winston.format.combine(
  redactFormat(),
  // Only when attached to a terminal — piped output and CI logs should not be
  // littered with ANSI escapes.
  ...(process.stdout.isTTY ? [winston.format.colorize()] : []),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...rest }) => {
    const extra = Object.keys(rest).length
      ? ` ${JSON.stringify(rest, null, 0)}`
      : '';
    return `${timestamp} ${level} ${message}${extra}`;
  })
);

// Structured JSON in production so Render/Sentry can parse it.
const prodFormat = winston.format.combine(
  redactFormat(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'verify-backend' },
  transports: [
    new winston.transports.Console({
      // Jest output stays readable; errors still surface via expect().
      silent: env.isTest && !process.env.LOG_IN_TESTS,
    }),
  ],
});

/** Exposed for unit tests — asserts redaction without booting a transport. */
export { redact as _redactForTest };
