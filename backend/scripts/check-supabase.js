/**
 * One-off connectivity probe. Run with `node --env-file=.env scripts/check-supabase.js`.
 *
 * Answers two separate questions:
 *   1. Can the backend reach the Supabase project with its service key?
 *   2. Have the migrations (0001, 0002) actually been applied — i.e. do the
 *      tables exist?
 *
 * Reachability and schema are distinct: valid credentials against an empty
 * project connect fine but every table query fails with "does not exist".
 */
/* eslint-disable no-console -- diagnostic script, stdout is the point */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error(
    '✗ SUPABASE_URL and/or SUPABASE_SERVICE_KEY are not set in .env'
  );
  process.exit(1);
}

console.log(`Project: ${new URL(url).host}\n`);

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  'organizations',
  'profiles',
  'courses',
  'certificates',
  'certificate_hashes',
  'claim_tokens',
  'verification_logs',
  'audit_events',
  'expiry_notifications',
];

let reachable = false;
let present = 0;

for (const table of TABLES) {
  const { error } = await supabase
    .from(table)
    .select('*', { head: true, count: 'exact' });

  if (!error) {
    reachable = true;
    present += 1;
    console.log(`  ✓ ${table}`);
  } else if (
    error.code === '42P01' || // undefined_table
    /does not exist|Could not find the table/i.test(error.message)
  ) {
    reachable = true; // we reached PostgREST; the table just isn't there
    console.log(`  ✗ ${table} — not created yet`);
  } else {
    console.log(`  ! ${table} — ${error.message} (code ${error.code ?? '—'})`);
  }
}

console.log('');
if (!reachable) {
  console.log(
    'Result: could NOT reach the project. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.'
  );
  process.exit(1);
} else if (present === TABLES.length) {
  console.log(
    `Result: connected, all ${TABLES.length} tables present. Migrations are applied. ✅`
  );
} else if (present === 0) {
  console.log(
    'Result: connected to the project, but NO tables exist yet.\n' +
      'Run db/migrations/0001_init.sql then 0002_rls.sql in the Supabase SQL editor.'
  );
} else {
  console.log(
    `Result: connected, but only ${present}/${TABLES.length} tables exist — migrations partially applied.`
  );
}
