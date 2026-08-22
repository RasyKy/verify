/**
 * A minimal in-memory stand-in for the supabase-js query builder.
 *
 * The real client returns a thenable builder, so the service code reads
 * `await db.from(t).select().eq(...).limit(1)`. This reproduces just enough of
 * that shape — chainable, awaitable, `{ data, error }` — to exercise
 * certificateService without a network or a project.
 *
 * Deliberately NOT a full PostgREST implementation:
 *   • `select()` argument strings are ignored. Embedded relations such as
 *     `organizations ( name )` are expressed by seeding the property directly
 *     on the row, which keeps the fake honest about what it does and does not
 *     model.
 *   • `or()` is a no-op. Search filtering is asserted through the real client
 *     in the live smoke path, not here.
 */
import { randomUUID } from 'node:crypto';

/**
 * @param {Record<string, object[]>} [seed] initial rows per table
 */
export function createFakeDb(seed = {}) {
  /** @type {Record<string, object[]>} */
  const store = {
    certificates: [],
    certificate_hashes: [],
    audit_events: [],
    verification_logs: [],
    organizations: [],
    ...structuredClone(seed),
  };

  /** Tables configured to fail, so error paths can be exercised. */
  const failures = new Map();

  function from(table) {
    store[table] ??= [];

    let op = 'select';
    /** @type {((row: object) => boolean)[]} */
    const filters = [];
    let payload = null;
    let limitN = null;
    let singleMode = false;
    let conflictColumn = 'id';

    const matches = (row) => filters.every((f) => f(row));

    function run() {
      if (failures.has(table)) {
        return { data: null, error: { message: failures.get(table) } };
      }

      let data;
      switch (op) {
        case 'insert': {
          const rows = (Array.isArray(payload) ? payload : [payload]).map(
            (row) => ({ id: randomUUID(), ...row })
          );
          store[table].push(...rows);
          data = rows;
          break;
        }
        case 'upsert': {
          const rows = Array.isArray(payload) ? payload : [payload];
          data = rows.map((row) => {
            const existing = store[table].find(
              (r) => r[conflictColumn] === row[conflictColumn]
            );
            if (existing) {
              Object.assign(existing, row);
              return existing;
            }
            const created = { id: randomUUID(), ...row };
            store[table].push(created);
            return created;
          });
          break;
        }
        case 'update': {
          data = store[table].filter(matches);
          for (const row of data) Object.assign(row, payload);
          break;
        }
        case 'delete': {
          data = store[table].filter(matches);
          store[table] = store[table].filter((row) => !matches(row));
          break;
        }
        default: {
          data = store[table].filter(matches);
          if (limitN != null) data = data.slice(0, limitN);
        }
      }

      return {
        data: singleMode ? (data[0] ?? null) : data,
        error: null,
      };
    }

    const builder = {
      select() {
        return builder;
      },
      insert(rows) {
        op = 'insert';
        payload = rows;
        return builder;
      },
      upsert(rows, options = {}) {
        op = 'upsert';
        payload = rows;
        conflictColumn = options.onConflict ?? 'id';
        return builder;
      },
      update(patch) {
        op = 'update';
        payload = patch;
        return builder;
      },
      delete() {
        op = 'delete';
        return builder;
      },
      eq(column, value) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      limit(n) {
        limitN = n;
        return builder;
      },
      order() {
        return builder;
      },
      or() {
        return builder;
      },
      single() {
        singleMode = true;
        return builder;
      },
      // Same shape as single() here. The real client differs only in that
      // single() errors on zero rows while maybeSingle() returns null; the
      // service code never depends on that distinction.
      maybeSingle() {
        singleMode = true;
        return builder;
      },
      // Makes the builder awaitable, exactly as supabase-js is.
      then(resolve, reject) {
        try {
          resolve(run());
        } catch (err) {
          reject(err);
        }
      },
    };

    return builder;
  }

  return {
    from,
    /** Direct access for assertions. */
    _store: store,
    /** Make every query against `table` return an error. */
    _failTable(table, message = 'simulated failure') {
      failures.set(table, message);
    },
  };
}

/**
 * A chain client whose responses each test controls, matching the interface in
 * services/blockchain.js.
 */
export function createFakeChain({
  verify = () => ({ exists: true, revoked: false, issuedAt: 0, expiresAt: 0 }),
  issue = () => ({
    txHash: '0xtx-issue',
    blockTimestamp: '2026-01-01T00:00:00.000Z',
    status: 'confirmed',
  }),
  revoke = () => ({ txHash: '0xtx-revoke', status: 'confirmed' }),
} = {}) {
  const calls = { issue: [], revoke: [], verify: [] };
  return {
    isEnabled: true,
    isStub: false,
    calls,

    async issue(hash, expiresAt) {
      calls.issue.push({ hash, expiresAt });
      return issue(hash, expiresAt);
    },

    async revoke(hash) {
      calls.revoke.push({ hash });
      return revoke(hash);
    },

    async verify(hash) {
      calls.verify.push({ hash });
      return verify(hash);
    },

    async checkIssuerRole() {
      return true;
    },
  };
}
