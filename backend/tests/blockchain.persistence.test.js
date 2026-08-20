/**
 * File-backed stub ledger.
 *
 * Guards the bug this was written to fix: with a purely in-memory Map, every
 * restart of the dev server wiped the ledger, and every certificate issued
 * before that restart then verified as `invalid`. Because `npm run dev` runs
 * under --watch, that happened on every file save.
 *
 * Uses the real filesystem — the whole point is the behaviour across processes,
 * which a mocked fs would not exercise.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStubService } from '../src/services/blockchain.js';

const HASH = `0x${'a'.repeat(64)}`;
const OTHER = `0x${'b'.repeat(64)}`;

let dir;
let ledger;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-stub-'));
  ledger = path.join(dir, 'chain.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('persistence', () => {
  it('a hash issued by one instance verifies in the next', async () => {
    const first = createStubService({ persistPath: ledger });
    await first.issue(HASH, 0);

    // Simulates the restart.
    const second = createStubService({ persistPath: ledger });

    expect(await second.verify(HASH)).toMatchObject({
      exists: true,
      revoked: false,
    });
  });

  it('carries a revocation across a restart', async () => {
    const first = createStubService({ persistPath: ledger });
    await first.issue(HASH, 0);
    await first.revoke(HASH);

    const second = createStubService({ persistPath: ledger });

    expect(await second.verify(HASH)).toMatchObject({
      exists: true,
      revoked: true,
    });
  });

  it('preserves the expiry passed at issuance', async () => {
    const expiresAt = 1893456000;
    await createStubService({ persistPath: ledger }).issue(HASH, expiresAt);

    const reloaded = createStubService({ persistPath: ledger });

    expect((await reloaded.verify(HASH)).expiresAt).toBe(expiresAt);
  });

  it('still enforces the contract invariant after reloading', async () => {
    await createStubService({ persistPath: ledger }).issue(HASH, 0);

    const second = createStubService({ persistPath: ledger });

    // Mirrors the Solidity's require(!exists) — a reloaded ledger must not have
    // forgotten what it already contains.
    await expect(second.issue(HASH, 0)).rejects.toThrow(/already exists/i);
  });

  it('starts empty when the ledger file does not exist yet', async () => {
    const service = createStubService({
      persistPath: path.join(dir, 'nope.json'),
    });

    expect(await service.verify(HASH)).toMatchObject({ exists: false });
  });

  it('starts empty rather than throwing when the ledger is corrupt', async () => {
    fs.writeFileSync(ledger, '{ not valid json');

    const service = createStubService({ persistPath: ledger });

    // A corrupt file must not take the whole API down at import time.
    expect(await service.verify(HASH)).toMatchObject({ exists: false });
    await expect(service.issue(HASH, 0)).resolves.toMatchObject({
      status: 'confirmed',
    });
  });

  it('does not touch the disk when no path is given', async () => {
    const service = createStubService();
    await service.issue(OTHER, 0);

    expect(fs.existsSync(ledger)).toBe(false);
    // And a second instance shares nothing with the first.
    expect(await createStubService().verify(OTHER)).toMatchObject({
      exists: false,
    });
  });
});
