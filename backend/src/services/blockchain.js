/**
 * Blockchain service — the backend's single point of contact with the
 * on-chain CertificateRegistry (blockchain/contracts/Verifier.sol).
 *
 * Two interchangeable implementations behind one interface, so every caller
 * (and every test) is written once:
 *
 *   createChainService()  — real ethers v6 client against Polygon/Amoy.
 *   createStubService()   — in-memory Map, no network. Used when the chain env
 *                           vars are absent (dev before the contract is
 *                           deployed) and in tests. This is what lets the whole
 *                           issue → verify → revoke flow be exercised locally
 *                           without an RPC endpoint or a funded wallet.
 *
 * Interface:
 *   isEnabled : boolean               real chain vs stub
 *   issue(hash, expiresAtUnix)        → { txHash, blockTimestamp|null, status }
 *   revoke(hash)                      → { txHash, status }
 *   verify(hash)                      → { exists, revoked, issuedAt, expiresAt }
 *   checkIssuerRole()                 → boolean   (diagnostics)
 *
 * `status` is 'confirmed' | 'pending'. A submitted-but-unconfirmed transaction
 * returns 'pending' rather than blocking past the timeout, so issuance stays
 * inside NFR-PERF-02 (30s) and jobs/reconcilePendingTx.js finishes the row.
 */
import fs from 'node:fs';

import { ethers } from 'ethers';

import verifierAbi from '../blockchain/abi/Verifier.json' with { type: 'json' };
import { env } from '../config/env.js';
import { chainVerifyCache } from '../lib/cache.js';
import { upstreamUnavailable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** Wait at most this long for a confirmation before returning 'pending'. */
const CONFIRMATION_TIMEOUT_MS = 25_000;

/**
 * A minimal serial queue.
 *
 * With a single relayer wallet, two issuances submitted at once would grab the
 * same nonce and one would be dropped. NonceManager assigns nonces optimistically,
 * but serialising submission keeps ordering deterministic and makes a stuck
 * transaction easy to reason about and retry. Reads (verify) do NOT go through
 * the queue — they must stay concurrent for NFR-PERF-03.
 */
function createSerialQueue() {
  let tail = Promise.resolve();
  return function enqueue(task) {
    const run = tail.then(task, task);
    // Keep the chain alive regardless of individual task outcome.
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

/** Normalises ethers' verify() tuple (bigints) into plain values. */
function normalizeVerifyResult(raw) {
  const [exists, revoked, issuedAt, expiresAt] = raw;
  return {
    exists: Boolean(exists),
    revoked: Boolean(revoked),
    issuedAt: Number(issuedAt), // unix seconds; safe well past year 2100
    expiresAt: Number(expiresAt), // 0 = never
  };
}

// ─── Real implementation ──────────────────────────────────────────────────────

export function createChainService({
  rpcUrl = env.ALCHEMY_RPC_URL,
  privateKey = env.PRIVATE_KEY,
  contractAddress = env.CONTRACT_ADDRESS,
  cache = chainVerifyCache,
} = {}) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  // NonceManager wraps the wallet so sequential sends get sequential nonces
  // without a round-trip to read the account nonce each time.
  const signer = new ethers.NonceManager(
    new ethers.Wallet(privateKey, provider)
  );
  const contract = new ethers.Contract(
    contractAddress,
    verifierAbi.abi,
    signer
  );
  const enqueue = createSerialQueue();

  /** Wraps an RPC failure as a 503 so it is never mistaken for a bad certificate. */
  function asUpstream(err, op) {
    logger.error(`blockchain ${op} failed`, {
      err,
      code: err?.code,
      reason: err?.shortMessage ?? err?.reason,
    });
    return upstreamUnavailable(
      'Blockchain network',
      `The blockchain network is temporarily unavailable (${op}). Please try again.`
    );
  }

  function issue(hash, expiresAtUnix) {
    return enqueue(async () => {
      let tx;
      try {
        tx = await contract.issue(hash, BigInt(expiresAtUnix));
      } catch (err) {
        throw asUpstream(err, 'issue');
      }
      try {
        const receipt = await tx.wait(1, CONFIRMATION_TIMEOUT_MS);
        const block = await provider.getBlock(receipt.blockNumber);
        return {
          txHash: tx.hash,
          blockTimestamp: block
            ? new Date(block.timestamp * 1000).toISOString()
            : null,
          status: 'confirmed',
        };
      } catch (err) {
        // Timed out waiting — the tx is in the mempool, just not mined yet.
        // Hand back 'pending' with the hash so the DB row is recoverable
        // rather than leaving the request hanging (NFR-PERF-02).
        if (err?.code === 'TIMEOUT') {
          logger.warn('issue confirmation timed out — marking pending', {
            txHash: tx.hash,
          });
          return { txHash: tx.hash, blockTimestamp: null, status: 'pending' };
        }
        throw asUpstream(err, 'issue-wait');
      }
    });
  }

  async function revoke(hash) {
    const result = await enqueue(async () => {
      let tx;
      try {
        tx = await contract.revoke(hash);
      } catch (err) {
        throw asUpstream(err, 'revoke');
      }
      try {
        await tx.wait(1, CONFIRMATION_TIMEOUT_MS);
        return { txHash: tx.hash, status: 'confirmed' };
      } catch (err) {
        if (err?.code === 'TIMEOUT') {
          return { txHash: tx.hash, status: 'pending' };
        }
        throw asUpstream(err, 'revoke-wait');
      }
    });
    // A revocation must be visible to the next verifier immediately, so drop
    // the cached (stale, non-revoked) chain result for this hash.
    cache.delete(hash);
    return result;
  }

  function verify(hash) {
    // Read-through 30s cache: a burst of verifications for one certificate
    // collapses to a single eth_call (NFR-PERF-03, T-04).
    return cache.wrap(hash, async () => {
      try {
        return normalizeVerifyResult(await contract.verify(hash));
      } catch (err) {
        throw asUpstream(err, 'verify');
      }
    });
  }

  async function checkIssuerRole() {
    try {
      const role = await contract.ISSUER_ROLE();
      const address = await signer.getAddress();
      return await contract.hasRole(role, address);
    } catch (err) {
      logger.warn('could not check ISSUER_ROLE', { err });
      return false;
    }
  }

  return {
    isEnabled: true,
    isStub: false,
    issue,
    revoke,
    verify,
    checkIssuerRole,
  };
}

// ─── In-memory stub ─────────────────────────────────────────────────────────

/**
 * Where the stub keeps its ledger between restarts. Resolved against the backend
 * package root (this file lives in src/services/). Gitignored.
 */
export const STUB_LEDGER_PATH = new URL(
  '../../.stub-chain.json',
  import.meta.url
);

/**
 * Behaves like the contract without a network. Enforces the same invariants the
 * Solidity does — "already exists" on double-issue, "does not exist" on revoke —
 * so code and tests written against it behave the same against the real chain.
 *
 * ── Why it persists to disk ──
 * A chain does not forget. With a bare Map, restarting the dev server (which
 * `npm run dev` does on every file save) wiped the ledger, and every certificate
 * issued before that restart then verified as `invalid` — the single worst
 * output this system can produce, arrived at by accident. A JSON file keeps the
 * stub an INDEPENDENT record rather than a second read of the database, so
 * tampering is still detected: edit a row in Supabase directly and the
 * recomputed hash stops matching the one recorded here.
 *
 * Persistence is opt-in via `persistPath` and left off under `test`, so the
 * suite stays hermetic and order-independent.
 *
 * No read cache: it is already an in-memory Map, so the read-through cache the
 * real service needs to keep eth_calls off the hot path would be pure overhead.
 * Callers get identical results either way; caching is transparent.
 *
 * Date.now() is used for the issue timestamp; that is fine in runtime code
 * (only Workflow scripts forbid it).
 *
 * @param {object} [options]
 * @param {URL|string|null} [options.persistPath] JSON file to load/save, or null
 *   for a pure in-memory ledger.
 */
export function createStubService({ persistPath = null } = {}) {
  /** @type {Map<string, { revoked: boolean, issuedAt: number, expiresAt: number }>} */
  const store = new Map();

  if (persistPath) {
    try {
      const raw = fs.readFileSync(persistPath, 'utf8');
      for (const [hash, record] of Object.entries(JSON.parse(raw))) {
        store.set(hash, record);
      }
      logger.info('stub chain ledger restored', { entries: store.size });
    } catch (err) {
      // ENOENT on first run is the normal case, not a problem. Anything else
      // (corrupt JSON, bad permissions) is worth saying out loud, because
      // silently starting empty would report issued certificates as invalid.
      if (err?.code !== 'ENOENT') {
        logger.warn('could not read stub chain ledger — starting empty', {
          err,
          path: String(persistPath),
        });
      }
    }
  }

  function persist() {
    if (!persistPath) return;
    try {
      fs.writeFileSync(
        persistPath,
        `${JSON.stringify(Object.fromEntries(store), null, 2)}\n`
      );
    } catch (err) {
      // Do not fail the issuance: the certificate is already in the database and
      // the in-memory ledger is correct for this process's lifetime.
      logger.error('could not persist stub chain ledger', {
        err,
        path: String(persistPath),
      });
    }
  }

  // eslint-disable-next-line require-await -- async to match the real interface
  async function issue(hash, expiresAtUnix) {
    if (store.has(hash)) {
      // Mirror the contract's require(!exists). A UUID-derived hash colliding
      // means a bug upstream, so surface it rather than silently overwrite.
      const err = new Error('Certificate already exists on chain (stub)');
      err.expected = true;
      err.status = 409;
      err.code = 'CHAIN_DUPLICATE';
      throw err;
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    store.set(hash, {
      revoked: false,
      issuedAt,
      expiresAt: Number(expiresAtUnix),
    });
    persist();
    return {
      txHash: `0xstub${hash.slice(2, 10)}`,
      blockTimestamp: new Date(issuedAt * 1000).toISOString(),
      status: 'confirmed',
    };
  }

  // eslint-disable-next-line require-await
  async function revoke(hash) {
    const record = store.get(hash);
    if (!record) {
      const err = new Error('Certificate does not exist on chain (stub)');
      err.expected = true;
      err.status = 409;
      err.code = 'CHAIN_NOT_FOUND';
      throw err;
    }
    record.revoked = true;
    persist();
    return { txHash: `0xstubrevoke${hash.slice(2, 8)}`, status: 'confirmed' };
  }

  // eslint-disable-next-line require-await
  async function verify(hash) {
    const record = store.get(hash);
    if (!record) {
      return { exists: false, revoked: false, issuedAt: 0, expiresAt: 0 };
    }
    return {
      exists: true,
      revoked: record.revoked,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
    };
  }

  // eslint-disable-next-line require-await
  async function checkIssuerRole() {
    return true;
  }

  return {
    isEnabled: false,
    isStub: true,
    issue,
    revoke,
    verify,
    checkIssuerRole,
    /** Test-only: inspect the in-memory ledger. */
    _store: store,
  };
}

/**
 * The process-wide instance. Real when the chain env vars are present,
 * otherwise the stub — so `npm run dev` works before the contract is deployed,
 * and issuance/verification can be tested end to end against the stub.
 */
export const blockchainService = env.blockchainEnabled
  ? createChainService()
  : // No persistence under `test`: the suite must not depend on, or leave
    // behind, a ledger file.
    createStubService({ persistPath: env.isTest ? null : STUB_LEDGER_PATH });

if (blockchainService.isStub) {
  logger.warn(
    'Blockchain service running in STUB mode (file-backed). Set ALCHEMY_RPC_URL, PRIVATE_KEY and CONTRACT_ADDRESS for the real chain.'
  );
}
