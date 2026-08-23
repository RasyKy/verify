/**
 * FR-EXP-03 — 60-day certificate expiry email notification.
 *
 * Runs once a day (wired in server.js). Finds certificates whose expiry_date
 * is exactly 60 days from today, are not revoked, and have not already been
 * notified — then emails the student and records the notification.
 *
 * ── The notification row is claimed BEFORE the email is sent ──
 * `expiry_notifications_once` (db/migrations/0001_init.sql) exists specifically
 * so "a job restart or a double fire cannot email the same holder twice." That
 * names duplicate delivery as the failure being guarded against, not a missed
 * one — so the slot is claimed first, and the email is only sent once the
 * claim succeeds. A crash between the two loses one notification silently
 * rather than risking a second copy landing in the same inbox, matching
 * sendClaimEmail's existing best-effort delivery philosophy.
 */
import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import { logger } from '../lib/logger.js';
import { todayUtc } from '../lib/derivedStatus.js';
import { sendExpiryReminderEmail as defaultSendExpiryReminderEmail } from '../services/email.js';

export const EXPIRY_NOTIFICATION_KIND = '60_day';
const WARNING_DAYS = 60;

/** 06:00 UTC daily. Passed to node-cron in server.js. */
export const EXPIRY_SWEEP_CRON = '0 6 * * *';

const CANDIDATE_SELECT = `
  id, student_name, student_email, course_name, expiry_date,
  organizations ( name )
`;

/**
 * Pure UTC date-string math, deliberately avoiding `Date` arithmetic across a
 * timezone — same reasoning as todayUtc()/isExpired() in lib/derivedStatus.js.
 * @returns {string} YYYY-MM-DD, `daysOut` days after "today" in UTC
 */
export function targetExpiryDate(now = new Date(), daysOut = WARNING_DAYS) {
  const todayMidnightUtc = new Date(`${todayUtc(now)}T00:00:00.000Z`).getTime();
  return new Date(todayMidnightUtc + daysOut * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function createExpiryNotificationsJob({
  adminClient = defaultAdminClient,
  sendExpiryReminderEmail = defaultSendExpiryReminderEmail,
} = {}) {
  async function findCandidates(targetDate) {
    const rows = unwrap(
      await adminClient
        .from('certificates')
        .select(CANDIDATE_SELECT)
        .eq('expiry_date', targetDate)
        .is('revoked_at', null),
      'find certificates expiring in 60 days'
    );
    return rows ?? [];
  }

  async function alreadyNotifiedIds(certificateIds) {
    if (certificateIds.length === 0) return new Set();
    const rows = unwrap(
      await adminClient
        .from('expiry_notifications')
        .select('certificate_id')
        .eq('kind', EXPIRY_NOTIFICATION_KIND)
        .in('certificate_id', certificateIds),
      'load existing expiry notifications'
    );
    return new Set((rows ?? []).map((r) => r.certificate_id));
  }

  /**
   * Claims the (certificate_id, kind) slot. Returns false — not an error —
   * when another run already claimed it first (Postgres unique_violation).
   */
  async function claimNotificationSlot(certificateId) {
    const { error } = await adminClient.from('expiry_notifications').insert({
      certificate_id: certificateId,
      kind: EXPIRY_NOTIFICATION_KIND,
    });
    if (!error) return true;
    if (error.code === '23505') return false;
    const err = new Error(
      `Supabase insert expiry_notifications failed: ${error.message}`
    );
    err.cause = error;
    err.supabaseCode = error.code;
    throw err;
  }

  /**
   * @returns {Promise<{targetDate: string, candidates: number, notified: number, skipped: number, failed: number}>}
   */
  async function run(now = new Date()) {
    const targetDate = targetExpiryDate(now);
    const summary = {
      targetDate,
      candidates: 0,
      notified: 0,
      skipped: 0,
      failed: 0,
    };

    let candidates;
    try {
      candidates = await findCandidates(targetDate);
    } catch (err) {
      logger.error('expiry sweep: failed to load candidates', {
        err,
        targetDate,
      });
      return summary;
    }
    summary.candidates = candidates.length;
    if (candidates.length === 0) return summary;

    const notified = await alreadyNotifiedIds(candidates.map((c) => c.id));

    for (const cert of candidates) {
      if (notified.has(cert.id)) {
        summary.skipped += 1;
        continue;
      }

      let claimed;
      try {
        claimed = await claimNotificationSlot(cert.id);
      } catch (err) {
        logger.error('expiry sweep: failed to record notification', {
          err,
          certificateId: cert.id,
        });
        summary.failed += 1;
        continue;
      }
      if (!claimed) {
        summary.skipped += 1;
        continue;
      }

      // sendExpiryReminderEmail never throws (mirrors sendClaimEmail) — the
      // 60-day boundary genuinely happened and the notification row is
      // already recorded, so a mail hiccup must not turn into a retry loop.
      const { sent } = await sendExpiryReminderEmail({
        to: cert.student_email,
        studentName: cert.student_name,
        courseName: cert.course_name,
        institutionName: cert.organizations?.name ?? 'Your institution',
        expiryDate: cert.expiry_date,
      });
      if (sent) summary.notified += 1;
    }

    logger.info('expiry sweep complete', summary);
    return summary;
  }

  return { run };
}

/** Process-wide instance used by server.js. */
export const expiryNotificationsJob = createExpiryNotificationsJob();
