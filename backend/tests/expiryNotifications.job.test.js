/**
 * Expiry sweep job tests (FR-EXP-03).
 *
 * Uses a hand-rolled Supabase query-builder fake rather than a mocking
 * library, because jest.mock() does not work under this project's
 * native-ESM Jest — same spirit as certificate.service.test.js's fakeDb(),
 * extended locally to actually apply .eq()/.is()/.in() filters against a
 * seeded row array, so filter-driven behaviour (revoked exclusion, exact
 * date match) is asserted through real query semantics rather than
 * hand-simulated per test.
 */
import { jest } from '@jest/globals';

import {
  createExpiryNotificationsJob,
  targetExpiryDate,
  EXPIRY_NOTIFICATION_KIND,
} from '../src/jobs/expiryNotifications.js';

/**
 * `tables` maps a table name to either a row array (select path) or a
 * function `(payload) => ({ error })` for `<table>.insert` overrides.
 */
function fakeDb(tables = {}) {
  const calls = [];

  function from(table) {
    const filters = [];
    const ctx = { table, op: 'select', payload: null };

    function resolve() {
      if (ctx.op === 'insert') {
        const handler = tables[`${table}.insert`];
        if (typeof handler === 'function') {
          const result = handler(ctx.payload);
          if (result?.error) return { data: null, error: result.error };
        }
        return { data: null, error: null };
      }

      const seed = tables[table];
      if (seed && !Array.isArray(seed) && seed.error) return seed;
      const rows = Array.isArray(seed) ? seed : [];

      const filtered = rows.filter((row) =>
        filters.every(([op, field, value]) => {
          if (op === 'eq') return row[field] === value;
          if (op === 'is') return value === null ? row[field] == null : row[field] === value;
          if (op === 'in') return value.includes(row[field]);
          return true;
        })
      );
      return { data: filtered, error: null };
    }

    const builder = {
      select: () => builder,
      insert: (payload) => {
        ctx.op = 'insert';
        ctx.payload = payload;
        calls.push({ table, op: 'insert', payload });
        return builder;
      },
      eq: (field, value) => {
        filters.push(['eq', field, value]);
        return builder;
      },
      is: (field, value) => {
        filters.push(['is', field, value]);
        return builder;
      },
      in: (field, values) => {
        filters.push(['in', field, values]);
        return builder;
      },
      then: (onOk, onErr) => Promise.resolve(resolve()).then(onOk, onErr),
    };
    return builder;
  }

  return { from, calls };
}

const TARGET_DATE = '2026-10-20';
const NOW = new Date('2026-08-21T06:00:00.000Z');

const CERT_A = {
  id: 'cert-a',
  student_name: 'Chea Sophat',
  student_email: 'sophat@example.com',
  course_name: 'Web Development Fundamentals',
  expiry_date: TARGET_DATE,
  revoked_at: null,
  organizations: { name: 'Royal Phnom Penh University' },
};

function makeJob({ db, sendExpiryReminderEmail } = {}) {
  return createExpiryNotificationsJob({
    adminClient: db ?? fakeDb(),
    sendExpiryReminderEmail:
      sendExpiryReminderEmail ?? jest.fn(async () => ({ sent: true })),
  });
}

describe('targetExpiryDate()', () => {
  it('computes exactly 60 days after "today" in UTC', () => {
    expect(targetExpiryDate(NOW)).toBe(TARGET_DATE);
  });

  it('crosses a month and year boundary correctly', () => {
    const now = new Date('2026-12-05T00:00:00.000Z');
    expect(targetExpiryDate(now)).toBe('2027-02-03');
  });
});

describe('run()', () => {
  it('finds a certificate whose expiry_date exactly matches the +60-day target', async () => {
    const db = fakeDb({ certificates: [CERT_A], expiry_notifications: [] });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.candidates).toBe(1);
    expect(summary.notified).toBe(1);
    expect(sendExpiryReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sophat@example.com',
        institutionName: 'Royal Phnom Penh University',
        expiryDate: TARGET_DATE,
      })
    );
  });

  it('excludes certificates expiring at +59 or +61 days', async () => {
    const nearMiss = [
      { ...CERT_A, id: 'cert-59', expiry_date: '2026-10-19' },
      { ...CERT_A, id: 'cert-61', expiry_date: '2026-10-21' },
    ];
    const db = fakeDb({ certificates: nearMiss, expiry_notifications: [] });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.candidates).toBe(0);
    expect(sendExpiryReminderEmail).not.toHaveBeenCalled();
  });

  it('excludes certificates already notified for kind: 60_day', async () => {
    const db = fakeDb({
      certificates: [CERT_A],
      expiry_notifications: [
        { certificate_id: 'cert-a', kind: EXPIRY_NOTIFICATION_KIND },
      ],
    });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.skipped).toBe(1);
    expect(summary.notified).toBe(0);
    expect(sendExpiryReminderEmail).not.toHaveBeenCalled();
  });

  it('excludes revoked certificates', async () => {
    const revoked = { ...CERT_A, revoked_at: '2026-07-01T00:00:00.000Z' };
    const db = fakeDb({ certificates: [revoked], expiry_notifications: [] });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.candidates).toBe(0);
    expect(sendExpiryReminderEmail).not.toHaveBeenCalled();
  });

  it('treats a duplicate-insert race (23505) as a skip, not an error', async () => {
    const db = fakeDb({
      certificates: [CERT_A],
      expiry_notifications: [],
      'expiry_notifications.insert': () => ({
        error: { code: '23505', message: 'duplicate key' },
      }),
    });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
    expect(sendExpiryReminderEmail).not.toHaveBeenCalled();
  });

  it('records the notification insert BEFORE calling sendExpiryReminderEmail', async () => {
    const db = fakeDb({ certificates: [CERT_A], expiry_notifications: [] });
    const order = [];
    const originalFrom = db.from;
    db.from = (table) => {
      const builder = originalFrom(table);
      if (table === 'expiry_notifications') {
        const originalInsert = builder.insert;
        builder.insert = (payload) => {
          order.push('insert');
          return originalInsert(payload);
        };
      }
      return builder;
    };
    const sendExpiryReminderEmail = jest.fn(async () => {
      order.push('email');
      return { sent: true };
    });

    const job = makeJob({ db, sendExpiryReminderEmail });
    await job.run(NOW);

    expect(order).toEqual(['insert', 'email']);
  });

  it('does not throw and does not roll back the notification row when the email send fails', async () => {
    const db = fakeDb({ certificates: [CERT_A], expiry_notifications: [] });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: false }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    const summary = await job.run(NOW);

    expect(summary.notified).toBe(0);
    const insertCall = db.calls.find(
      (c) => c.table === 'expiry_notifications' && c.op === 'insert'
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall.payload).toEqual({
      certificate_id: 'cert-a',
      kind: EXPIRY_NOTIFICATION_KIND,
    });
  });

  it('logs and resolves without throwing when loading candidates fails', async () => {
    const db = fakeDb({
      certificates: { error: { code: '500', message: 'db unreachable' } },
    });
    const sendExpiryReminderEmail = jest.fn(async () => ({ sent: true }));
    const job = makeJob({ db, sendExpiryReminderEmail });

    await expect(job.run(NOW)).resolves.toMatchObject({ candidates: 0 });
    expect(sendExpiryReminderEmail).not.toHaveBeenCalled();
  });
});
