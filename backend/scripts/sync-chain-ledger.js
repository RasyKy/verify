/**
 * Replays the database's current certificate hashes onto the chain service.
 *
 * ── Why this exists ──
 * `npm run db:seed` writes synthetic blockchain columns: the transaction hashes
 * in the seed data do not correspond to anything that was ever issued. The
 * verification path does not read those columns — it recomputes the hash and
 * asks the registry — so every seeded certificate verifies as `invalid` until
 * its hash actually exists somewhere. Running this after a seed makes the
 * fixtures behave like real issuances.
 *
 * ── It is also the mainnet/testnet backfill ──
 * Certificates issued while the contract was undeployed live only in the stub
 * ledger. After `Verifier.sol` is deployed and CONTRACT_ADDRESS is set, running
 * this exact script against the real chain replays them on-chain. Same code,
 * because `blockchainService` presents one interface either way.
 *
 * Idempotent: it verifies before it writes, so a second run is a no-op and an
 * interrupted run can simply be repeated.
 *
 *   node --env-file=.env scripts/sync-chain-ledger.js
 *   node --env-file=.env scripts/sync-chain-ledger.js --dry-run
 */
import { adminClient, unwrap } from '../src/config/supabase.js';
import { blockchainService } from '../src/services/blockchain.js';

const dryRun = process.argv.includes('--dry-run');

function line(symbol, message) {
  process.stdout.write(`  ${symbol} ${message}\n`);
}

async function main() {
  process.stdout.write(
    `\nChain ledger sync — target: ${
      blockchainService.isStub ? 'in-memory stub (file-backed)' : 'REAL CHAIN'
    }${dryRun ? ' [dry run]' : ''}\n\n`
  );

  if (!blockchainService.isStub && !dryRun) {
    // Writing to a real chain costs gas and is irreversible. Make that a
    // deliberate act rather than something a stray command does.
    if (!process.argv.includes('--yes')) {
      line('!', 'Refusing to write to a real chain without --yes.');
      line(' ', 'Re-run with --dry-run first, then add --yes.');
      process.exitCode = 1;
      return;
    }
  }

  // `is_current` only: a superseded hash was deliberately revoked and reissued,
  // and replaying it would put a retired credential back into circulation.
  const rows = unwrap(
    await adminClient
      .from('certificate_hashes')
      .select('hash, expires_at_unix, revoked_at, certificate_id')
      .eq('is_current', true),
    'load certificate hashes'
  );

  if (!rows?.length) {
    line('·', 'No certificate hashes found — nothing to sync.');
    return;
  }

  // A certificate revoked in the database must end up revoked on chain too.
  const certIds = [...new Set(rows.map((r) => r.certificate_id))];
  const certs = unwrap(
    await adminClient
      .from('certificates')
      .select('id, revoked_at')
      .in('id', certIds),
    'load certificates'
  );
  const revokedCerts = new Set(
    (certs ?? []).filter((c) => c.revoked_at).map((c) => c.id)
  );

  let issued = 0;
  let revoked = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const state = await blockchainService.verify(row.hash);

      if (!state.exists) {
        if (dryRun) {
          line('+', `would issue  ${row.hash.slice(0, 18)}…`);
        } else {
          await blockchainService.issue(row.hash, Number(row.expires_at_unix) || 0);
          line('+', `issued       ${row.hash.slice(0, 18)}…`);
        }
        issued += 1;
      } else {
        skipped += 1;
      }

      const shouldBeRevoked =
        Boolean(row.revoked_at) || revokedCerts.has(row.certificate_id);

      if (shouldBeRevoked && !state.revoked) {
        if (dryRun) {
          line('-', `would revoke ${row.hash.slice(0, 18)}…`);
        } else {
          await blockchainService.revoke(row.hash);
          line('-', `revoked      ${row.hash.slice(0, 18)}…`);
        }
        revoked += 1;
      }
    } catch (err) {
      failed += 1;
      line('!', `${row.hash.slice(0, 18)}… — ${err.message}`);
    }
  }

  process.stdout.write(
    `\n${dryRun ? 'Would issue' : 'Issued'}: ${issued} · ${
      dryRun ? 'would revoke' : 'revoked'
    }: ${revoked} · already present: ${skipped} · failed: ${failed}\n\n`
  );

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`\nChain ledger sync failed: ${err.message}\n\n`);
  process.exitCode = 1;
});
