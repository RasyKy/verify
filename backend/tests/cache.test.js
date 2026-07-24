/**
 * The TTL cache is what keeps 50 concurrent verifications (NFR-PERF-03) from
 * becoming 50 Alchemy calls, so its coalescing and eviction behaviour matter.
 */
// Under native ESM, Jest injects describe/it/expect but NOT `jest` — the mock
// factory has to be imported explicitly.
import { jest } from '@jest/globals';

import { TtlCache } from '../src/lib/cache.js';

describe('TtlCache', () => {
  it('returns a stored value', () => {
    const c = new TtlCache();
    c.set('k', 'v');
    expect(c.get('k')).toBe('v');
  });

  it('misses on an unknown key', () => {
    expect(new TtlCache().get('nope')).toBeUndefined();
  });

  it('expires an entry after its TTL', async () => {
    const c = new TtlCache({ ttlMs: 20 });
    c.set('k', 'v');
    expect(c.get('k')).toBe('v');
    await new Promise((r) => setTimeout(r, 35));
    expect(c.get('k')).toBeUndefined();
  });

  it('drops an entry on delete — how a revocation becomes visible immediately', () => {
    const c = new TtlCache();
    c.set('hash', { revoked: false });
    c.delete('hash');
    expect(c.get('hash')).toBeUndefined();
  });

  it('evicts the oldest entry once maxEntries is reached', () => {
    const c = new TtlCache({ maxEntries: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('d', 4); // evicts 'a'
    expect(c.get('a')).toBeUndefined();
    expect(c.get('d')).toBe(4);
    expect(c.stats.size).toBe(3);
  });

  it('does not evict when overwriting an existing key', () => {
    const c = new TtlCache({ maxEntries: 2 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 9);
    expect(c.get('b')).toBe(2);
    expect(c.get('a')).toBe(9);
  });

  describe('wrap', () => {
    it('calls the producer once and caches the result', async () => {
      const c = new TtlCache();
      const produce = jest.fn().mockResolvedValue('chain-result');

      expect(await c.wrap('k', produce)).toBe('chain-result');
      expect(await c.wrap('k', produce)).toBe('chain-result');
      expect(produce).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent misses into a single upstream call', async () => {
      const c = new TtlCache();
      let calls = 0;
      const produce = () => {
        calls += 1;
        return new Promise((r) => setTimeout(() => r('once'), 20));
      };

      // 50 simultaneous verifications of the same certificate — the exact
      // NFR-PERF-03 scenario. Must produce one eth_call, not 50.
      const results = await Promise.all(
        Array.from({ length: 50 }, () => c.wrap('same-hash', produce))
      );

      expect(calls).toBe(1);
      expect(new Set(results)).toEqual(new Set(['once']));
    });

    it('does not cache a rejection — an RPC blip must not pin an error', async () => {
      const c = new TtlCache();
      const failing = jest.fn().mockRejectedValue(new Error('RPC down'));

      await expect(c.wrap('k', failing)).rejects.toThrow('RPC down');
      expect(c.get('k')).toBeUndefined();

      const recovered = jest.fn().mockResolvedValue('back');
      expect(await c.wrap('k', recovered)).toBe('back');
    });

    it('tracks hits and misses', async () => {
      const c = new TtlCache();
      await c.wrap('k', () => Promise.resolve(1));
      await c.wrap('k', () => Promise.resolve(1));
      expect(c.stats.hits).toBeGreaterThan(0);
      expect(c.stats.misses).toBeGreaterThan(0);
    });
  });
});
