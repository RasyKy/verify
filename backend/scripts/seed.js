/**
 * Development seed data, built for exercising the API from Postman.
 *
 *   node --env-file=.env scripts/seed.js
 *   node --env-file=.env scripts/seed.js --clean   (remove seed data, insert nothing)
 *   node --env-file=.env scripts/seed.js --chain   (anchor every hash on Amoy for real)
 *
 * Re-runnable: every run deletes what a previous run created before inserting,
 * so there is no "already exists" failure mode and no accumulating duplicates.
 *
 * ── Two things this deliberately does the hard way ──
 *
 * Auth users are created through `auth.admin.createUser`, not inserted into
 * `profiles` directly. `profiles.id` is a foreign key onto `auth.users`, so a
 * bare insert cannot work — and a profile without a real auth user could never
 * log in, which is the entire point of seeding it.
 *
 * Certificate hashes come from the actual `computeCertificateHash` in
 * services/hash.js rather than random hex. A hardcoded hash would make every
 * seeded certificate read as Invalid the moment verification recomputes it,
 * which is precisely the bug the seed exists to help you catch.
 *
 * Blockchain fields (issue_tx_hash, chain_issued_at) are SYNTHETIC by default:
 * shaped correctly so response payloads look right, but no block explorer will
 * find them. Pass `--chain` to anchor every hash on the real contract instead
 * and record the transactions that actually happened.
 *
 * Note the default seed produces certificates that verify as INVALID against
 * the real chain, because their hashes were never issued on it. That is
 * intentional for offline work — but it means `--chain` is what you want as
 * soon as the verify page is pointed at a live backend.
 */
/* eslint-disable no-console -- seeding script, stdout is the point */
import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { computeCertificateHash, expiryToUnix } from '../src/services/hash.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const rawUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!rawUrl || !serviceKey) {
  console.error('✗ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const url = new URL(rawUrl).origin;
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cleanOnly = process.argv.includes('--clean');

/**
 * `--chain` anchors every seeded certificate on the real contract instead of
 * writing synthetic transaction hashes. Opt-in because it costs testnet gas and
 * needs a funded wallet holding ISSUER_ROLE.
 *
 * Worth knowing before you use it: the seeded dates are relative to today
 * (`day(-400)`), and the date is part of the hash preimage — so each run
 * produces a different set of hashes. Previous runs' hashes stay on chain
 * forever; nothing can delete them. That is harmless on a testnet, but it does
 * mean re-seeding is not free.
 */
const useChain = process.argv.includes('--chain');

/** One password for every seeded account. Development only, obviously. */
const PASSWORD = 'Password123!';

// Fixed UUIDs so a Postman collection can hardcode paths like
// /api/certificates/30000000-0000-4000-8000-000000000001 and keep working
// across re-seeds. Auth user IDs are assigned by Supabase and cannot be fixed,
// so those are reported at the end instead.
const ORG = {
  rupp: '10000000-0000-4000-8000-000000000001',
  istad: '10000000-0000-4000-8000-000000000002',
  defunct: '10000000-0000-4000-8000-000000000003',
};

const COURSE = {
  cs: '20000000-0000-4000-8000-000000000001',
  data: '20000000-0000-4000-8000-000000000002',
  web: '20000000-0000-4000-8000-000000000003',
  chain: '20000000-0000-4000-8000-000000000004',
};

const CERT = {
  valid: '30000000-0000-4000-8000-000000000001',
  unclaimed: '30000000-0000-4000-8000-000000000002',
  expired: '30000000-0000-4000-8000-000000000003',
  revoked: '30000000-0000-4000-8000-000000000004',
  hidden: '30000000-0000-4000-8000-000000000005',
  expiringSoon: '30000000-0000-4000-8000-000000000006',
};

/** @param {number} days offset from today @returns {string} YYYY-MM-DD */
function day(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** @param {number} days @returns {string} ISO timestamp */
function ts(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * Anchors the seeded hashes on the real contract, rewriting each row's chain
 * fields in place with the transaction that actually happened.
 *
 * Two rules, both about not lying in the database:
 *
 *   • A hash already on chain keeps a NULL `issue_tx_hash`. The contract emits
 *     no events, so there is no log to recover the original transaction from —
 *     and a synthetic hash that 404s on a block explorer is worse than an
 *     honest null.
 *   • The artificial `pending` status is dropped. With no reconcile job built
 *     yet, a permanently-pending row is just a record that looks broken.
 *
 * @param {object[]} hashes rows about to be inserted, mutated in place
 * @param {object[]} certificates the matching certificate rows
 */
async function anchorOnChain(hashes, certificates) {
  const { ethers } = await import('ethers');
  const abi = (
    await import('../src/blockchain/abi/Verifier.json', {
      with: { type: 'json' },
    })
  ).default;

  const { ALCHEMY_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;
  if (!ALCHEMY_RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error(
      '✗ --chain needs ALCHEMY_RPC_URL, PRIVATE_KEY and CONTRACT_ADDRESS in .env'
    );
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi.abi, wallet);

  const role = await contract.ISSUER_ROLE();
  if (!(await contract.hasRole(role, wallet.address))) {
    console.error(`✗ ${wallet.address} does not hold ISSUER_ROLE.`);
    process.exit(1);
  }

  // Price the whole run up front. Running out of gas halfway would leave some
  // certificates anchored and others not — the exact inconsistency this flag
  // exists to remove.
  const revocations = certificates.filter((c) => c.revoked_at).length;
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
  const needed =
    gasPrice *
    (90_000n * BigInt(hashes.length) + 50_000n * BigInt(revocations));
  const balance = await provider.getBalance(wallet.address);

  console.log(
    `\nAnchoring ${hashes.length} certificates on chain (${revocations} to revoke)`
  );
  console.log(`  estimated cost ${ethers.formatEther(needed)} POL`);
  console.log(`  balance        ${ethers.formatEther(balance)} POL`);

  if (balance < needed) {
    console.error(
      `\n✗ Not enough gas for the full run. Top up at ` +
        `https://faucet.polygon.technology (Amoy) and try again.\n` +
        '  Nothing has been written — re-run when funded.'
    );
    process.exit(1);
  }

  for (const [i, row] of hashes.entries()) {
    const cert = certificates[i];
    const label = `${i + 1}/${hashes.length} ${cert.student_name}`;

    const [exists] = await contract.verify(row.hash);
    if (exists) {
      // Already anchored by an earlier run with identical inputs.
      const [, , issuedAt] = await contract.verify(row.hash);
      row.issue_tx_hash = null;
      row.chain_issued_at = new Date(Number(issuedAt) * 1000).toISOString();
      row.chain_status = 'confirmed';
      console.log(`  ${label} — already on chain, tx unrecoverable`);
    } else {
      const tx = await contract.issue(row.hash, BigInt(row.expires_at_unix));
      const receipt = await tx.wait(1);
      const block = await provider.getBlock(receipt.blockNumber);
      row.issue_tx_hash = tx.hash;
      row.chain_issued_at = new Date(block.timestamp * 1000).toISOString();
      row.chain_status = 'confirmed';
      console.log(`  ${label} — issued ${tx.hash}`);
    }

    if (cert.revoked_at) {
      const [, alreadyRevoked] = await contract.verify(row.hash);
      if (alreadyRevoked) {
        row.revoke_tx_hash = null;
        console.log(`  ${label} — already revoked on chain`);
      } else {
        const tx = await contract.revoke(row.hash);
        await tx.wait(1);
        row.revoke_tx_hash = tx.hash;
        console.log(`  ${label} — revoked ${tx.hash}`);
      }
    } else {
      row.revoke_tx_hash = null;
    }
  }

  const spent = balance - (await provider.getBalance(wallet.address));
  console.log(`  gas spent ${ethers.formatEther(spent)} POL\n`);
}

const USERS = [
  {
    key: 'admin',
    email: 'admin@example.com',
    full_name: 'Platform Admin',
    role: 'admin',
    organization_id: null,
    status: 'active',
  },
  {
    key: 'issuerRupp',
    email: 'issuer.rupp@example.com',
    full_name: 'Sok Dara',
    role: 'issuer',
    organization_id: ORG.rupp,
    status: 'active',
  },
  {
    key: 'issuerIstad',
    email: 'issuer.istad@example.com',
    full_name: 'Chan Pisey',
    role: 'issuer',
    organization_id: ORG.istad,
    status: 'active',
  },
  {
    key: 'holderSophat',
    email: 'holder.sophat@example.com',
    full_name: 'Chea Sophat',
    role: 'holder',
    organization_id: null,
    status: 'active',
  },
  {
    // Name carries a precomposed é (U+00E9). services/hash.js NFC-normalises,
    // so this row is the one that catches a regression where the decomposed
    // form (e + U+0301) hashes differently and a genuine certificate is
    // reported as forged.
    key: 'holderSophea',
    email: 'holder.sophea@example.com',
    full_name: 'Sophéa Kim',
    role: 'holder',
    organization_id: null,
    status: 'active',
  },
  {
    // Logs in successfully, then every protected route must answer 403.
    key: 'deactivated',
    email: 'deactivated@example.com',
    full_name: 'Former Staff',
    role: 'issuer',
    organization_id: ORG.rupp,
    status: 'deactivated',
  },
];

const SEED_EMAILS = USERS.map((u) => u.email);

// ── Teardown ────────────────────────────────────────────────────────────────
// Order matters: children before parents. `certificates.organization_id` and
// `profiles.organization_id` are ON DELETE RESTRICT, so organizations must go
// last or Postgres refuses.

async function clean() {
  const certIds = Object.values(CERT);

  const steps = [
    ['expiry_notifications', (q) => q.in('certificate_id', certIds)],
    ['claim_tokens', (q) => q.in('certificate_id', certIds)],
    ['certificate_hashes', (q) => q.in('certificate_id', certIds)],
    ['verification_logs', (q) => q.in('certificate_id', certIds)],
    ['audit_events', (q) => q.in('organization_id', Object.values(ORG))],
    ['certificates', (q) => q.in('id', certIds)],
    ['courses', (q) => q.in('id', Object.values(COURSE))],
    ['profiles', (q) => q.in('email', SEED_EMAILS)],
    ['organizations', (q) => q.in('id', Object.values(ORG))],
  ];

  for (const [table, filter] of steps) {
    const { error } = await filter(db.from(table).delete());
    if (error && error.code !== 'PGRST116') {
      throw new Error(`clean ${table}: ${error.message}`);
    }
  }

  // Auth users last — deleting one cascades to any profile row that survived
  // the step above, which keeps a partially-failed run from wedging the seed.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  for (const user of data.users) {
    if (SEED_EMAILS.includes(user.email)) {
      const { error: delErr } = await db.auth.admin.deleteUser(user.id);
      if (delErr)
        throw new Error(`deleteUser ${user.email}: ${delErr.message}`);
    }
  }
}

/** Supabase returns errors in-band; make them throw. */
function must(result, context) {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  const ids = {};

  must(
    await db.from('organizations').insert([
      {
        id: ORG.rupp,
        name: 'Royal University of Phnom Penh',
        slug: 'rupp',
        type: 'university',
        website: 'https://rupp.edu.kh',
        status: 'active',
        accredited: true,
        joined_at: day(-400),
      },
      {
        id: ORG.istad,
        name: 'Institute of Science and Technology Advanced Development',
        slug: 'istad',
        type: 'bootcamp',
        website: 'https://istad.co',
        status: 'active',
        accredited: true,
        joined_at: day(-200),
      },
      {
        // Suspended and unaccredited: the negative case for the public registry
        // (FR-REG-01) and for any org-status gate on issuance.
        id: ORG.defunct,
        name: 'Defunct Training Academy',
        slug: 'defunct-academy',
        type: 'professional-body',
        status: 'suspended',
        accredited: false,
        joined_at: day(-600),
      },
    ]),
    'insert organizations'
  );

  for (const user of USERS) {
    const created = await db.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true, // skip the confirmation mail; these must log in now
      app_metadata: { role: user.role },
      user_metadata: { full_name: user.full_name },
    });
    if (created.error) {
      throw new Error(`createUser ${user.email}: ${created.error.message}`);
    }
    ids[user.key] = created.data.user.id;

    // A trigger may already have inserted a bare profile row; upsert so the
    // seed owns the role/org/status regardless of whether one exists.
    must(
      await db.from('profiles').upsert(
        {
          id: created.data.user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          organization_id: user.organization_id,
          status: user.status,
          profile_is_public: true,
        },
        { onConflict: 'id' }
      ),
      `upsert profile ${user.email}`
    );
  }

  must(
    await db.from('courses').insert([
      {
        id: COURSE.cs,
        organization_id: ORG.rupp,
        name: 'BSc Computer Science',
        created_by: ids.issuerRupp,
      },
      {
        id: COURSE.data,
        organization_id: ORG.rupp,
        name: 'MSc Data Science',
        created_by: ids.issuerRupp,
      },
      {
        id: COURSE.web,
        organization_id: ORG.istad,
        name: 'Advanced Web Development',
        created_by: ids.issuerIstad,
      },
      {
        id: COURSE.chain,
        organization_id: ORG.istad,
        name: 'Blockchain Fundamentals',
        created_by: ids.issuerIstad,
      },
    ]),
    'insert courses'
  );

  // One certificate per derived status, so every branch of derivedStatus.js has
  // a row that reaches it. `course_name` is written as a snapshot string
  // alongside course_id — see the note in 0001_init.sql.
  const certificates = [
    {
      id: CERT.valid,
      organization_id: ORG.rupp,
      issuer_id: ids.issuerRupp,
      holder_id: ids.holderSophat,
      student_name: 'Chea Sophat',
      student_email: 'holder.sophat@example.com',
      course_name: 'BSc Computer Science',
      course_id: COURSE.cs,
      completion_date: day(-400),
      expiry_date: null,
      claim_state: 'claimed',
      claimed_at: ts(-390),
      is_hidden: false,
    },
    {
      id: CERT.unclaimed,
      organization_id: ORG.rupp,
      issuer_id: ids.issuerRupp,
      holder_id: null,
      student_name: 'Nou Chanthy',
      student_email: 'chanthy@example.com',
      course_name: 'MSc Data Science',
      course_id: COURSE.data,
      completion_date: day(-30),
      expiry_date: day(1000),
      claim_state: 'unclaimed',
      claimed_at: null,
      is_hidden: false,
    },
    {
      id: CERT.expired,
      organization_id: ORG.istad,
      issuer_id: ids.issuerIstad,
      holder_id: ids.holderSophea,
      student_name: 'Sophéa Kim',
      student_email: 'holder.sophea@example.com',
      course_name: 'Advanced Web Development',
      course_id: COURSE.web,
      completion_date: day(-800),
      expiry_date: day(-60), // already past → derives to 'expired'
      claim_state: 'claimed',
      claimed_at: ts(-790),
      is_hidden: false,
    },
    {
      id: CERT.revoked,
      organization_id: ORG.istad,
      issuer_id: ids.issuerIstad,
      holder_id: null,
      student_name: 'Pich Rayuth',
      student_email: 'rayuth@example.com',
      course_name: 'Blockchain Fundamentals',
      course_id: COURSE.chain,
      completion_date: day(-120),
      expiry_date: null,
      claim_state: 'unclaimed',
      claimed_at: null,
      revoked_at: ts(-10),
      revoked_by: ids.issuerIstad,
      revoke_reason: 'Issued against an incorrect completion record.',
      is_hidden: false,
    },
    {
      // FR-HOLD-06: absent from the holder's public profile, still verifiable
      // by direct URL (FR-HOLD-07). Those two must be tested against one row.
      id: CERT.hidden,
      organization_id: ORG.rupp,
      issuer_id: ids.issuerRupp,
      holder_id: ids.holderSophat,
      student_name: 'Chea Sophat',
      student_email: 'holder.sophat@example.com',
      course_name: 'MSc Data Science',
      course_id: COURSE.data,
      completion_date: day(-200),
      expiry_date: null,
      claim_state: 'claimed',
      claimed_at: ts(-195),
      is_hidden: true,
    },
    {
      // Inside the 60-day window the expiry sweep looks for (FR-EXP-03).
      id: CERT.expiringSoon,
      organization_id: ORG.rupp,
      issuer_id: ids.issuerRupp,
      holder_id: ids.holderSophea,
      student_name: 'Sophéa Kim',
      student_email: 'holder.sophea@example.com',
      course_name: 'BSc Computer Science',
      course_id: COURSE.cs,
      completion_date: day(-700),
      expiry_date: day(30),
      claim_state: 'claimed',
      claimed_at: ts(-690),
      is_hidden: false,
    },
  ];

  must(
    await db.from('certificates').insert(certificates),
    'insert certificates'
  );

  // Real hashes, computed exactly as the verification path will recompute them.
  const hashes = certificates.map((c) => ({
    certificate_id: c.id,
    hash: computeCertificateHash({
      certId: c.id,
      studentName: c.student_name,
      courseName: c.course_name,
      completionDate: c.completion_date,
      expiryDate: c.expiry_date,
    }),
    hash_version: 1,
    expires_at_unix: expiryToUnix(c.expiry_date),
    // Synthetic — see the header note. Deterministic so re-seeding is stable.
    issue_tx_hash: `0x${crypto.createHash('sha256').update(`issue:${c.id}`).digest('hex')}`,
    revoke_tx_hash: c.revoked_at
      ? `0x${crypto.createHash('sha256').update(`revoke:${c.id}`).digest('hex')}`
      : null,
    chain_issued_at: ts(-100),
    // The unclaimed row is left pending so jobs/reconcilePendingTx.js has
    // something to pick up.
    chain_status: c.id === CERT.unclaimed ? 'pending' : 'confirmed',
    revoked_at: c.revoked_at ?? null,
    is_current: true,
  }));

  if (useChain) {
    await anchorOnChain(hashes, certificates);
  }

  must(
    await db.from('certificate_hashes').insert(hashes),
    'insert certificate_hashes'
  );

  // Raw token is returned to the caller and never stored — only its SHA-256,
  // so a database leak yields no working claim link (T-02).
  const claimToken = crypto.randomBytes(32).toString('hex');
  const claimTokenHash = crypto
    .createHash('sha256')
    .update(claimToken)
    .digest('hex');

  must(
    await db.from('claim_tokens').insert([
      {
        certificate_id: CERT.unclaimed,
        token_hash: claimTokenHash,
        expires_at: ts(14),
        sent_to: 'chanthy@example.com',
      },
    ]),
    'insert claim_tokens'
  );

  // An already-used token on the revoked certificate: the partial unique index
  // only permits one row with used_at IS NULL, so a second live token would be
  // rejected. This one is spent, which is the case that must still be allowed.
  const usedToken = crypto.randomBytes(32).toString('hex');
  must(
    await db.from('claim_tokens').insert([
      {
        certificate_id: CERT.revoked,
        token_hash: crypto.createHash('sha256').update(usedToken).digest('hex'),
        expires_at: ts(-5),
        used_at: ts(-8),
        sent_to: 'rayuth@example.com',
      },
    ]),
    'insert used claim_token'
  );

  must(
    await db.from('verification_logs').insert([
      {
        certificate_id: CERT.valid,
        queried_id: CERT.valid,
        result: 'verified',
        ip_hash: crypto
          .createHash('sha256')
          .update('203.0.113.4')
          .digest('hex'),
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        created_at: ts(-3),
      },
      {
        certificate_id: CERT.expired,
        queried_id: CERT.expired,
        result: 'expired',
        ip_hash: crypto
          .createHash('sha256')
          .update('203.0.113.9')
          .digest('hex'),
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        created_at: ts(-2),
      },
      {
        certificate_id: CERT.revoked,
        queried_id: CERT.revoked,
        result: 'revoked',
        ip_hash: crypto
          .createHash('sha256')
          .update('203.0.113.9')
          .digest('hex'),
        user_agent: 'curl/8.4.0',
        created_at: ts(-1),
      },
      {
        // No certificate_id: a lookup that matched nothing. Repeated rows like
        // these from one ip_hash are the enumeration signal T-04 watches for.
        certificate_id: null,
        queried_id: 'not-a-real-certificate-id',
        result: 'not_found',
        ip_hash: crypto
          .createHash('sha256')
          .update('198.51.100.7')
          .digest('hex'),
        user_agent: 'python-requests/2.31.0',
        created_at: ts(-1),
      },
    ]),
    'insert verification_logs'
  );

  must(
    await db.from('audit_events').insert([
      {
        actor_id: ids.issuerRupp,
        actor_email: 'issuer.rupp@example.com',
        actor_name: 'Sok Dara',
        action: 'certificate.issued',
        target_label: 'Chea Sophat — BSc Computer Science',
        organization_id: ORG.rupp,
        metadata: { certificate_id: CERT.valid },
        created_at: ts(-400),
      },
      {
        actor_id: ids.holderSophat,
        actor_email: 'holder.sophat@example.com',
        actor_name: 'Chea Sophat',
        action: 'certificate.claimed',
        target_label: 'Chea Sophat — BSc Computer Science',
        organization_id: ORG.rupp,
        metadata: { certificate_id: CERT.valid },
        created_at: ts(-390),
      },
      {
        actor_id: ids.issuerIstad,
        actor_email: 'issuer.istad@example.com',
        actor_name: 'Chan Pisey',
        action: 'certificate.revoked',
        target_label: 'Pich Rayuth — Blockchain Fundamentals',
        organization_id: ORG.istad,
        metadata: {
          certificate_id: CERT.revoked,
          reason: 'Issued against an incorrect completion record.',
        },
        created_at: ts(-10),
      },
      {
        actor_id: ids.admin,
        actor_email: 'admin@example.com',
        actor_name: 'Platform Admin',
        action: 'org.suspended',
        target_label: 'Defunct Training Academy',
        organization_id: ORG.defunct,
        metadata: {},
        created_at: ts(-20),
      },
    ]),
    'insert audit_events'
  );

  must(
    await db
      .from('expiry_notifications')
      .insert([
        { certificate_id: CERT.expiringSoon, kind: '60_day', sent_at: ts(-1) },
      ]),
    'insert expiry_notifications'
  );

  return { ids, claimToken };
}

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`Project: ${new URL(url).host}\n`);

console.log('Removing any previous seed data …');
await clean();

if (cleanOnly) {
  console.log('Done — seed data removed, nothing inserted.');
  process.exit(0);
}

console.log('Seeding …\n');
const { ids, claimToken } = await seed();

console.log('Accounts  (password for all: %s)', PASSWORD);
for (const user of USERS) {
  const org =
    Object.entries(ORG).find(([, v]) => v === user.organization_id)?.[0] ?? '—';
  console.log(
    `  ${user.email.padEnd(30)} ${user.role.padEnd(7)} org=${String(org).padEnd(8)} ${user.status}`
  );
}

console.log('\nCertificates');
console.log(`  ${CERT.valid}  valid (claimed)`);
console.log(`  ${CERT.unclaimed}  unclaimed — has a live claim token`);
console.log(`  ${CERT.expired}  expired`);
console.log(`  ${CERT.revoked}  revoked`);
console.log(`  ${CERT.hidden}  hidden from public profile, still verifiable`);
console.log(`  ${CERT.expiringSoon}  expires in 30 days`);

console.log('\nClaim token (raw — only the SHA-256 is stored):');
console.log(`  ${claimToken}`);
console.log(
  `  → GET  ${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/claim/${claimToken}`
);

// A Postman environment beats a wall of IDs to copy by hand.
const envFile = join(HERE, '..', 'db', 'postman_environment.json');
await writeFile(
  envFile,
  `${JSON.stringify(
    {
      id: 'verify-local-seed',
      name: 'Verify — local (seeded)',
      values: [
        {
          key: 'baseUrl',
          value: `http://localhost:${process.env.PORT ?? 3001}`,
          enabled: true,
        },
        { key: 'password', value: PASSWORD, enabled: true },
        { key: 'adminEmail', value: 'admin@example.com', enabled: true },
        { key: 'issuerEmail', value: 'issuer.rupp@example.com', enabled: true },
        {
          key: 'issuer2Email',
          value: 'issuer.istad@example.com',
          enabled: true,
        },
        {
          key: 'holderEmail',
          value: 'holder.sophat@example.com',
          enabled: true,
        },
        {
          key: 'deactivatedEmail',
          value: 'deactivated@example.com',
          enabled: true,
        },
        { key: 'adminId', value: ids.admin, enabled: true },
        { key: 'issuerId', value: ids.issuerRupp, enabled: true },
        { key: 'holderId', value: ids.holderSophat, enabled: true },
        { key: 'orgRupp', value: ORG.rupp, enabled: true },
        { key: 'orgIstad', value: ORG.istad, enabled: true },
        { key: 'certValid', value: CERT.valid, enabled: true },
        { key: 'certUnclaimed', value: CERT.unclaimed, enabled: true },
        { key: 'certExpired', value: CERT.expired, enabled: true },
        { key: 'certRevoked', value: CERT.revoked, enabled: true },
        { key: 'certHidden', value: CERT.hidden, enabled: true },
        { key: 'certExpiringSoon', value: CERT.expiringSoon, enabled: true },
        { key: 'claimToken', value: claimToken, enabled: true },
        { key: 'accessToken', value: '', enabled: true },
        { key: 'refreshToken', value: '', enabled: true },
      ],
      _postman_variable_scope: 'environment',
    },
    null,
    2
  )}\n`,
  'utf8'
);

console.log(`\nPostman environment written to db/postman_environment.json`);
console.log('  Postman → Environments → Import → select that file\n');
console.log('Get a token:');
console.log(
  `  curl -s localhost:${process.env.PORT ?? 3001}/api/auth/login \\\n` +
    `    -H 'Content-Type: application/json' \\\n` +
    `    -d '{"email":"issuer.rupp@example.com","password":"${PASSWORD}"}'`
);
