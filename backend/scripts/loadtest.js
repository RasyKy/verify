/**
 * NFR-PERF-01/02/03 verification. Run with `node --env-file=.env scripts/loadtest.js`
 * against an already-running local backend (default http://localhost:3001).
 *
 * Standalone and throwaway — hits real seeded data (scripts/seed.js) over HTTP,
 * touches no production code. Uses Node's built-in fetch, no new dependency.
 *
 * ── Why the 50-concurrent test spoofs X-Forwarded-For ──
 * verifyLimiter caps at 30 req/60s per IP (middleware/rateLimit.js), and app.js
 * sets `trust proxy: 1`. A real "50 concurrent verifiers" scenario is 50
 * different people at 50 different IPs, not one script tripping its own
 * abuse-prevention limiter — so each request gets a distinct spoofed IP to
 * measure actual backend/chain concurrency capacity, not the rate limiter.
 *
 * ── Why the burst hits the same certificate ID ──
 * chainVerifyCache (lib/cache.js) is a 30s TTL cache built specifically for
 * NFR-PERF-03: concurrent misses for the same cert hash share one in-flight
 * upstream call. Bursting the same seeded cert is the realistic scenario (a
 * viral share) and exercises that coalescing path for real — but it means this
 * number reflects a warm/coalesced burst, not 50 independent cold reads. The
 * report says so explicitly rather than let the number be misread.
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */

const BASE = process.env.LOADTEST_BASE_URL ?? 'http://localhost:3001';
const VALID_CERT_ID = '30000000-0000-4000-8000-000000000001';
const ISSUER_EMAIL = 'issuer.rupp@example.com';
const ISSUER_PASSWORD = 'Password123!';

async function timed(fn) {
  const start = performance.now();
  const response = await fn();
  const ms = performance.now() - start;
  return { ms, response, body: await response.json().catch(() => null) };
}

function percentile(sortedMs, p) {
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.max(0, idx)];
}

function verdict(pass) {
  return pass ? 'PASS' : 'FAIL';
}

async function assertBackendUp() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    console.error(
      `✗ Could not reach ${BASE}/api/health — is the backend running? (${err.message})`
    );
    process.exit(1);
  }
}

async function login() {
  const { ms, response, body } = await timed(() =>
    fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ISSUER_EMAIL, password: ISSUER_PASSWORD }),
    })
  );
  if (!response.ok) {
    console.error(`✗ Login failed (${response.status}):`, body);
    process.exit(1);
  }
  console.log(`  login ok — ${ms.toFixed(0)}ms`);
  return body.accessToken;
}

function issuancePayload() {
  const stamp = Date.now();
  return {
    studentName: 'Load Test Student',
    studentEmail: `loadtest+${stamp}@example.com`,
    courseName: `NFR-PERF-02 Load Test ${stamp}`,
    completionDate: new Date().toISOString().slice(0, 10),
    expiryDate: null,
  };
}

async function main() {
  console.log(`Target: ${BASE}\n`);
  await assertBackendUp();

  // ── 1. NFR-PERF-01 — single verify, end-to-end ──────────────────────────
  console.log('1. NFR-PERF-01 (verify ≤ 5s)');
  const verifyOnce = await timed(() =>
    fetch(`${BASE}/api/certificates/verify/${VALID_CERT_ID}`)
  );
  const verifyOnceSeconds = verifyOnce.ms / 1000;
  console.log(
    `   ${verifyOnceSeconds.toFixed(3)}s — status ${verifyOnce.response.status}, body.status=${verifyOnce.body?.status}`
  );
  const perf01Pass = verifyOnce.response.ok && verifyOnceSeconds <= 5;
  console.log(`   ${verdict(perf01Pass)}\n`);

  // ── 2. NFR-PERF-02 — issuance incl. real chain confirmation ─────────────
  console.log('2. NFR-PERF-02 (issuance incl. blockchain ≤ 30s)');
  const accessToken = await login();
  const issueOnce = await timed(() =>
    fetch(`${BASE}/api/certificates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issuancePayload()),
    })
  );
  const issueOnceSeconds = issueOnce.ms / 1000;
  console.log(
    `   ${issueOnceSeconds.toFixed(3)}s — status ${issueOnce.response.status}, chain_status=${issueOnce.body?.chain_status}, issue_tx_hash=${issueOnce.body?.issue_tx_hash}`
  );
  const perf02Pass = issueOnce.response.status === 201 && issueOnceSeconds <= 30;
  console.log(`   ${verdict(perf02Pass)}\n`);

  // ── 3. NFR-PERF-03 — 50 concurrent verifications, distinct spoofed IPs ──
  console.log('3. NFR-PERF-03 (50 concurrent verifications, no degradation)');
  console.log(
    '   Note: same cert ID, distinct X-Forwarded-For per request — measures'
  );
  console.log(
    '   the coalesced/warm-cache burst path (chainVerifyCache), and bypasses'
  );
  console.log(
    '   verifyLimiter\'s per-IP cap to simulate 50 distinct verifiers, not'
  );
  console.log('   50 requests from one client hitting its own rate limit.\n');

  const burst = await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      timed(() =>
        fetch(`${BASE}/api/certificates/verify/${VALID_CERT_ID}`, {
          headers: { 'X-Forwarded-For': `10.${Math.floor(i / 255)}.${i % 255}.1` },
        })
      )
    )
  );

  const burstMs = burst.map((r) => r.ms).sort((a, b) => a - b);
  const failures = burst.filter((r) => !r.response.ok);
  const statusCounts = burst.reduce((acc, r) => {
    acc[r.response.status] = (acc[r.response.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`   requests: 50, succeeded: ${50 - failures.length}, failed: ${failures.length}`);
  console.log(`   status codes: ${JSON.stringify(statusCounts)}`);
  console.log(`   p50: ${percentile(burstMs, 50).toFixed(1)}ms`);
  console.log(`   p95: ${percentile(burstMs, 95).toFixed(1)}ms`);
  console.log(`   p99: ${percentile(burstMs, 99).toFixed(1)}ms`);
  console.log(`   max: ${burstMs[burstMs.length - 1].toFixed(1)}ms`);
  const perf03Pass = failures.length === 0;
  console.log(`   ${verdict(perf03Pass)}\n`);

  // ── 4. NFR-USE-02 — out of scope for this method ────────────────────────
  console.log('4. NFR-USE-02 (first-time verifier confirms within 30s of QR scan)');
  console.log(
    '   NOT VERIFIABLE by a load test — this is human task-completion time,'
  );
  console.log(
    '   not request latency. Needs an informal timed walkthrough with a real'
  );
  console.log(
    `   person scanning a real QR code. The NFR-PERF-01 number above (${verifyOnceSeconds.toFixed(3)}s)`
  );
  console.log(
    '   is a necessary lower bound for it, not a substitute measurement.\n'
  );

  console.log('Summary');
  console.log(`  NFR-PERF-01  ${verdict(perf01Pass)}  (${verifyOnceSeconds.toFixed(3)}s / 5s target)`);
  console.log(`  NFR-PERF-02  ${verdict(perf02Pass)}  (${issueOnceSeconds.toFixed(3)}s / 30s target)`);
  console.log(`  NFR-PERF-03  ${verdict(perf03Pass)}  (${failures.length}/50 failed, p99 ${percentile(burstMs, 99).toFixed(1)}ms)`);
  console.log('  NFR-USE-02   NOT VERIFIABLE by this method');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
