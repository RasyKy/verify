/**
 * Applies db/migrations/*.sql to the Supabase project, in filename order.
 *
 * Run with:
 *   SUPABASE_ACCESS_TOKEN=sbp_… node --env-file=.env scripts/apply-migrations.js
 *
 * Why a personal access token and not SUPABASE_SERVICE_KEY: the service key
 * talks to PostgREST, which only ever exposes tables that already exist. DDL
 * has to go somewhere else. The Management API's /database/query endpoint runs
 * arbitrary SQL against the project, and it authenticates with an account-level
 * token (Account → Access Tokens), not a project API key.
 *
 * Each file is sent as one request, so it lands in a single implicit
 * transaction: a syntax error halfway through 0001 leaves no half-built schema
 * behind. Files are NOT tracked in a migrations table — this is a bootstrap
 * tool, and re-running 0001 fails loudly on `create type` rather than silently
 * doing nothing, which is the safer default when there is no ledger.
 *
 * Verify the result with scripts/check-supabase.js.
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'migrations'
);

const token = process.env.SUPABASE_ACCESS_TOKEN;
const rawUrl = process.env.SUPABASE_URL;

if (!token) {
  console.error(
    '✗ SUPABASE_ACCESS_TOKEN is not set.\n' +
      '  Create one at https://supabase.com/dashboard/account/tokens\n' +
      '  Then: SUPABASE_ACCESS_TOKEN=sbp_… node --env-file=.env scripts/apply-migrations.js'
  );
  process.exit(1);
}
if (!rawUrl) {
  console.error('✗ SUPABASE_URL is not set in .env');
  process.exit(1);
}

// The project ref is the first label of the Supabase hostname.
const host = new URL(rawUrl).host;
const projectRef = host.split('.')[0];

if (!/^[a-z]{20}$/.test(projectRef)) {
  console.error(
    `✗ Could not read a project ref from SUPABASE_URL ("${host}").\n` +
      '  Expected something like https://abcdefghijklmnopqrst.supabase.co'
  );
  process.exit(1);
}

/**
 * @param {string} sql
 * @returns {Promise<{ ok: boolean, status: number, body: unknown }>}
 */
async function runSql(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

console.log(`Project: ${host}\n`);

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`✗ No .sql files found in ${MIGRATIONS_DIR}`);
  process.exit(1);
}

for (const file of files) {
  const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
  process.stdout.write(`  → ${file} … `);

  const { ok, status, body } = await runSql(sql);

  if (ok) {
    console.log('applied ✓');
    continue;
  }

  const message =
    (body && typeof body === 'object' && (body.message || body.error)) ||
    (typeof body === 'string' ? body : JSON.stringify(body));

  console.log(`FAILED (HTTP ${status})`);
  console.error(`\n✗ ${file} did not apply:\n  ${message}\n`);
  if (status === 401) {
    console.error(
      '  A 401 means the access token is wrong or expired — that is an account\n' +
        '  token (sbp_…), not the project service key (sb_secret_…).'
    );
  }
  process.exit(1);
}

console.log('\nAll migrations applied. Verify with:');
console.log('  node --env-file=.env scripts/check-supabase.js');
