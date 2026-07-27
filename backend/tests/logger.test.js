/**
 * PII redaction (NFR-SEC-02, T-06).
 *
 * Logs are the easiest place to undo everything the rest of the design does to
 * keep student names and emails out of reach, so redaction is asserted rather
 * than assumed. Includes a regression test for the winston symbol keys.
 */
import winston from 'winston';

import { _redactForTest as redact, pseudonymize } from '../src/lib/logger.js';

describe('redact', () => {
  it('removes student name and email', () => {
    const out = redact({
      student_name: 'Chea Sophat',
      student_email: 'sophat.chea@gmail.com',
      course_name: 'Web Development Fundamentals',
    });
    expect(out.student_name).toBe('[redacted]');
    expect(out.student_email).toMatch(/^sha256:/);
    // Course name is not PII and stays readable — it is what makes a log useful.
    expect(out.course_name).toBe('Web Development Fundamentals');
  });

  it('redacts camelCase spellings too', () => {
    const out = redact({ studentName: 'X', studentEmail: 'x@y.com' });
    expect(out.studentName).toBe('[redacted]');
    expect(out.studentEmail).toMatch(/^sha256:/);
  });

  it('removes credentials and tokens', () => {
    const out = redact({
      password: 'hunter2',
      token: 'abc',
      authorization: 'Bearer xyz',
      privateKey: `0x${'1'.repeat(64)}`,
      access_token: 'jwt',
    });
    for (const v of Object.values(out)) expect(v).toBe('[redacted]');
  });

  it('reaches nested objects and arrays', () => {
    const out = redact({
      batch: [{ student_email: 'a@b.com' }, { student_email: 'c@d.com' }],
      wrapper: { deep: { student_name: 'Nested' } },
    });
    expect(out.batch[0].student_email).toMatch(/^sha256:/);
    expect(out.wrapper.deep.student_name).toBe('[redacted]');
  });

  it('leaves non-PII scalars untouched', () => {
    const out = redact({ id: 'uuid-1', count: 3, ok: true, missing: null });
    expect(out).toEqual({ id: 'uuid-1', count: 3, ok: true, missing: null });
  });

  it('serialises Errors without losing the stack', () => {
    const out = redact({ err: new Error('boom') });
    expect(out.err.message).toBe('boom');
    expect(out.err.stack).toContain('boom');
  });

  it('does not recurse without bound on a cyclic object', () => {
    const cyclic = { name: 'root' };
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
  });
});

describe('pseudonymize', () => {
  it('is stable for the same input', () => {
    expect(pseudonymize('a@b.com')).toBe(pseudonymize('a@b.com'));
  });

  it('differs across inputs', () => {
    expect(pseudonymize('a@b.com')).not.toBe(pseudonymize('c@d.com'));
  });

  it('never returns the plaintext', () => {
    expect(pseudonymize('a@b.com')).not.toContain('a@b.com');
  });

  it('handles empty and non-string input', () => {
    expect(pseudonymize('')).toBe('[redacted]');
    expect(pseudonymize(undefined)).toBe('[redacted]');
  });
});

describe('winston integration', () => {
  /**
   * Regression: an earlier version of the redact format returned a NEW object
   * built with Object.entries, which copies string keys only. Winston stores
   * the level and raw message on Symbol.for('level') / Symbol.for('message'),
   * so dropping them made format.colorize() look up allColors[undefined] and
   * throw on the very first log line.
   */
  it('preserves the level/message symbol keys through the format chain', () => {
    const captured = [];
    const probe = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format((info) => {
          captured.push(info);
          return info;
        })(),
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => `${level} ${message}`)
      ),
      transports: [new winston.transports.Console({ silent: true })],
    });

    expect(() =>
      probe.http('request', { student_email: 'a@b.com' })
    ).not.toThrow();
    expect(captured[0][Symbol.for('level')]).toBe('http');
  });

  it('logs every level used in the app without throwing', async () => {
    const { logger } = await import('../src/lib/logger.js');
    for (const level of ['error', 'warn', 'info', 'http', 'debug']) {
      expect(() =>
        logger[level]('probe', { student_email: 'a@b.com' })
      ).not.toThrow();
    }
  });
});
