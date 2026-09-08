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

/**
 * Shared cache for certificateRenderCanvas.js's rendered PNGs (the
 * "base" render — background, text, QR — never the status stamp; see that
 * module's stampOnto() for why). Measured, not assumed, before building
 * this: a Supabase Storage round-trip for the same purpose was ~200ms,
 * SLOWER than just rendering fresh (44-108ms) — see this session's design
 * notes. An in-process cache has none of that network cost and correctly
 * serves the actual hot path (the same certificate's dashboard card
 * reloading repeatedly in one session). 30 minutes because staleness isn't
 * a correctness concern here the way it is for chainVerifyCache above —
 * the cache key already folds in every field that can change without a new
 * certificate id (see certificateRenderCanvas.js's renderCacheKey()), so a
 * stale HIT is structurally impossible, not just unlikely. 100 entries
 * caps memory on Render's small instance — full-size PNGs run
 * ~0.5-1.8MB each.
 */
export const certificateRenderCache = new TtlCache({
  ttlMs: 30 * 60_000,
  maxEntries: 100,
});

/**
 * Shared cache for DECODED remote images used while rendering a certificate —
 * an organization's logo and signature (see templates/certificates/canvas/
 * remoteImage.js) and the QR brand mark (certificateRenderCanvas.js).
 *
 * Distinct from certificateRenderCache above: that one caches a finished
 * certificate PNG per certId, this one caches an Image per URL. The reason
 * it's worth a separate cache rather than relying on the PNG cache alone:
 * organizationAssets.js's uploadAsset() stores logo/signature at a STABLE key
 * per organization (`{orgId}/{kind}.{ext}`), so the same URL is reused across
 * every certificate that organization has ever issued — without this, every
 * cache-miss render (a first view, or a 30-minute-stale one) paid a fresh
 * network round trip to Supabase Storage for an image that a different
 * certificate's render had already fetched moments earlier. Measured as the
 * dominant cost separating "fast locally" (dev certs with no real uploaded
 * branding, so this path never ran) from "not under 100ms" once deployed
 * (real orgs' certs all resolve a real logoUrl/signatureUrl).
 *
 * A re-upload changes the URL (`?v=${Date.now()}` — see organizationAssets.js
 * uploadAsset()'s comment), so a stale cached bitmap for the OLD url is
 * merely inert, never served under the new one — the same "no invalidation
 * needed" property certificateRenderCache's branding-hash key relies on.
 * `wrap()`'s in-flight-collapsing matters here too: an org's first few
 * certificates ever being viewed in the same moment result in exactly one
 * fetch of that org's logo, not one per certificate. 60-minute TTL is
 * generous since staleness is a non-issue by construction; entries are tiny
 * in number (bounded by distinct org branding URLs in use, not by
 * certificate count) so 200 is comfortable headroom, not a tight cap.
 */
export const remoteAssetImageCache = new TtlCache({
  ttlMs: 60 * 60_000,
  maxEntries: 200,
});
