/**
 * Tiny in-process TTL cache.
 *
 * Sole purpose: keep on-chain reads off the critical path for public
 * verification. Every `/verify/:certId` hit would otherwise cost an `eth_call`
 * to Alchemy — at 50 concurrent verifications (NFR-PERF-03) that is both slow
 * and a quick way through the RPC quota. On-chain state for a given hash
 * changes at most twice in its life (issue, revoke), so a short TTL is safe,
 * and `delete()` on revoke keeps revocations visible well inside the 30s the
 * Success Criteria allow.
 *
 * In-process and per-instance by design — with one Render instance that is
 * sufficient, and it removes Redis from the MVP. If the API is ever scaled
 * horizontally, a stale read can persist for at most `ttlMs`.
 */
export class TtlCache {
  /**
   * @param {object} [options]
   * @param {number} [options.ttlMs=30000] entry lifetime
   * @param {number} [options.maxEntries=5000] bound so a flood of unique
   *   certificate IDs cannot grow the map without limit (T-04)
   */
  constructor({ ttlMs = 30_000, maxEntries = 5000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    /** @type {Map<string, { value: unknown, expiresAt: number }>} */
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    // Map preserves insertion order, so the first key is the oldest.
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  /**
   * Read-through helper. Concurrent misses for the same key share one
   * in-flight promise, so a burst of verifications for the same certificate
   * produces exactly one upstream call rather than N.
   *
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} produce
   * @returns {Promise<T>}
   */
  // `async` here is load-bearing despite there being no `await`: it converts a
  // synchronous throw from produce() into a rejected promise, so a caller's
  // .catch() cannot be bypassed.
  // eslint-disable-next-line require-await
  async wrap(key, produce, ttlMs = this.ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = produce().then(
      (value) => {
        this.set(key, value, ttlMs);
        return value;
      },
      (err) => {
        // Never cache a failure — an RPC blip must not pin an error for 30s.
        this.delete(key);
        throw err;
      }
    );

    // Store the promise itself so racing callers await the same work.
    this.set(key, pending, ttlMs);
    return pending;
  }

  get stats() {
    return { size: this.store.size, hits: this.hits, misses: this.misses };
  }
}

/** Shared cache for on-chain `verify(hash)` results. */
export const chainVerifyCache = new TtlCache({ ttlMs: 30_000 });
