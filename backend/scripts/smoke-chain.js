/**
 * Live proof that the chain layer actually works.
 *
 *   npm run smoke:chain
 *
 * Runs the full issue → verify → revoke → verify cycle against the real
 * contract on Amoy and prints the transaction hashes so they can be opened on
 * a block explorer. This is the check the unit suite cannot make: those tests
 * inject a stub, so a misconfigured RPC URL or a wallet that lost ISSUER_ROLE
 * would leave them green while nothing reached the chain.
 *
 * Deliberately NOT part of `npm test`. It needs network, credentials and gas,
 * and would make the suite slow, flaky and dependent on a funded wallet.
 *
 * Touches no database rows: the hash is random, not a real certificate, so a
 * run leaves Supabase untouched and only costs testnet gas.
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */
import crypto from 'node:crypto';

import { ethers } from 'ethers';

import verifierAbi from '../src/blockchain/abi/Verifier.json' with { type: 'json' };

const { ALCHEMY_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, CHAIN_ID } =
  process.env;

if (!ALCHEMY_RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error(
    '✗ ALCHEMY_RPC_URL, PRIVATE_KEY and CONTRACT_ADDRESS must be set in .env'
  );
  process.exit(1);
}

const EXPLORER = 'https://amoy.polygonscan.com';
const ok = (m) => console.log(`  ✓ ${m}`);
const step = (m) => console.log(`\n▸ ${m}`);

const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, verifierAbi.abi, wallet);

// ── Preflight ───────────────────────────────────────────────────────────────
step('Preflight');

const network = await provider.getNetwork();
if (CHAIN_ID && network.chainId !== BigInt(CHAIN_ID)) {
  console.error(
    `✗ RPC is on chain ${network.chainId}, but CHAIN_ID says ${CHAIN_ID}. ` +
      'The RPC URL and the configured chain disagree.'
  );
  process.exit(1);
}
ok(`connected to chain ${network.chainId}`);

if ((await provider.getCode(CONTRACT_ADDRESS)) === '0x') {
  console.error(`✗ No contract deployed at ${CONTRACT_ADDRESS}.`);
  process.exit(1);
}
ok(`contract present at ${CONTRACT_ADDRESS}`);

const issuerRole = await contract.ISSUER_ROLE();
if (!(await contract.hasRole(issuerRole, wallet.address))) {
  console.error(
    `✗ ${wallet.address} does not hold ISSUER_ROLE — issue() would revert.\n` +
      '  Grant it with blockchain/scripts/grantIssuer.ts.'
  );
  process.exit(1);
}
ok(`${wallet.address} holds ISSUER_ROLE`);

// One issue plus one revoke, with headroom. Better to say so now than to fail
// halfway through and leave a certificate issued but not revoked.
const balance = await provider.getBalance(wallet.address);
const feeData = await provider.getFeeData();
const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
const estimated = gasPrice * 200_000n;
console.log(`  ℹ balance ${ethers.formatEther(balance)} POL`);
if (balance < estimated) {
  console.error(
    `✗ Not enough gas: this run needs about ${ethers.formatEther(estimated)} POL.\n` +
      '  Top up at https://faucet.polygon.technology (Amoy).'
  );
  process.exit(1);
}

// Random, so it cannot collide with a real certificate or a previous run.
const hash = `0x${crypto.randomBytes(32).toString('hex')}`;
// 0 = never expires, the contract's sentinel.
const expiresAt = 0n;
console.log(`  ℹ test hash ${hash}`);

let failures = 0;
function expect(label, actual, wanted) {
  if (actual === wanted) return ok(`${label}: ${actual}`);
  failures += 1;
  console.error(`  ✗ ${label}: expected ${wanted}, got ${actual}`);
}

// ── Issue ───────────────────────────────────────────────────────────────────
step('Issue');
const issueTx = await contract.issue(hash, expiresAt);
console.log(`  … submitted ${issueTx.hash}`);
const issueReceipt = await issueTx.wait(1);
ok(`mined in block ${issueReceipt.blockNumber}`);
console.log(`  → ${EXPLORER}/tx/${issueTx.hash}`);

step('Verify after issue');
const afterIssue = await contract.verify(hash);
expect('exists', afterIssue[0], true);
expect('revoked', afterIssue[1], false);
const issuedAt = Number(afterIssue[2]);
ok(`issuedAt ${issuedAt} (${new Date(issuedAt * 1000).toISOString()})`);

// ── Revoke ──────────────────────────────────────────────────────────────────
step('Revoke');
const revokeTx = await contract.revoke(hash);
console.log(`  … submitted ${revokeTx.hash}`);
const revokeReceipt = await revokeTx.wait(1);
ok(`mined in block ${revokeReceipt.blockNumber}`);
console.log(`  → ${EXPLORER}/tx/${revokeTx.hash}`);

step('Verify after revoke');
const afterRevoke = await contract.verify(hash);
expect('exists', afterRevoke[0], true);
expect('revoked', afterRevoke[1], true);

// ── Negative control ────────────────────────────────────────────────────────
// Without this, a verify() that returned `exists: true` for everything would
// still pass every check above.
step('Verify an unissued hash');
const unknown = await contract.verify(
  `0x${crypto.randomBytes(32).toString('hex')}`
);
expect('exists', unknown[0], false);

// ── Result ──────────────────────────────────────────────────────────────────
const spent = balance - (await provider.getBalance(wallet.address));
console.log(`\nGas spent: ${ethers.formatEther(spent)} POL`);
console.log(
  `Remaining: ${ethers.formatEther(await provider.getBalance(wallet.address))} POL`
);

if (failures > 0) {
  console.error(`\n✗ FAIL — ${failures} assertion(s) did not hold.`);
  process.exit(1);
}
console.log('\n✓ PASS — issue, verify, revoke all confirmed on chain.');
