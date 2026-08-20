/**
 * Issuer dashboard (FR-MGMT-05) — GET /api/dashboard?range=7d|30d|90d
 *
 * Feeds three components on pages/issuer/index.vue: the stat cards, the
 * issuance line chart, and the recent-activity list.
 *
 * `chartData` is ZERO-FILLED for every day in the range. A line chart drawn from
 * only the days that had issuances would join 3-on-Monday straight to
 * 2-on-Friday and read as a smooth trend across a week where nothing happened —
 * the gap is information, and omitting the points misrepresents the data.
 */
import { Router } from 'express';

import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import { issuerStatus } from '../lib/derivedStatus.js';
import {
  requireAuth,
  requireOrganization,
  requireRole,
  ROLES,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { dashboardQuerySchema } from '../schemas/certificate.js';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

/** YYYY-MM-DD, `daysAgo` days before `now`, in UTC. */
function dayKey(now, daysAgo = 0) {
  return new Date(now.getTime() - daysAgo * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function createDashboardRouter({
  adminClient = defaultAdminClient,
  requireAuth: auth = requireAuth,
} = {}) {
  const router = Router();

  /**
   * @openapi
   * /api/dashboard:
   *   get:
   *     summary: Issuer dashboard stats, chart series and recent activity
   *     tags: [Dashboard]
   */
  router.get(
    '/dashboard',
    auth,
    requireRole(ROLES.ISSUER),
    requireOrganization,
    validate(dashboardQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const now = new Date();
        const days = RANGE_DAYS[req.validated.query.range] ?? 30;
        const since = new Date(now.getTime() - (days - 1) * 86_400_000);
        since.setUTCHours(0, 0, 0, 0);

        // Stats cover the organization's whole history, not the selected range:
        // "total certificates" meaning "total in the last 7 days" would be a
        // surprising reading of an unlabelled number.
        const all = unwrap(
          await adminClient
            .from('certificates')
            .select(
              'id, student_name, course_name, created_at, claimed_at, revoked_at, expiry_date, claim_state'
            )
            .eq('organization_id', req.user.organizationId)
            .order('created_at', { ascending: false }),
          'load dashboard certificates'
        );
        const rows = all ?? [];

        const stats = { total: rows.length, valid: 0, revoked: 0, expired: 0 };
        for (const row of rows) {
          const status = issuerStatus(row, now);
          // `unclaimed` has no stat card — it is counted in `total` only, which
          // matches the four cards the page renders.
          if (status in stats && status !== 'total') stats[status] += 1;
        }

        const buckets = new Map();
        for (let i = days - 1; i >= 0; i -= 1) buckets.set(dayKey(now, i), 0);
        for (const row of rows) {
          const key = String(row.created_at).slice(0, 10);
          if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
        }
        const chartData = [...buckets].map(([date, count]) => ({
          date,
          count,
        }));

        // Three event types, because those are the three the activity list has
        // icons for (IssuerRecentActivity.vue).
        const events = [];
        for (const row of rows) {
          events.push({
            type: 'issued',
            studentName: row.student_name,
            courseName: row.course_name,
            timestamp: row.created_at,
          });
          if (row.claimed_at) {
            events.push({
              type: 'claimed',
              studentName: row.student_name,
              courseName: row.course_name,
              timestamp: row.claimed_at,
            });
          }
          if (row.revoked_at) {
            events.push({
              type: 'revoked',
              studentName: row.student_name,
              courseName: row.course_name,
              timestamp: row.revoked_at,
            });
          }
        }
        events.sort((a, b) =>
          String(b.timestamp).localeCompare(String(a.timestamp))
        );

        res.json({ stats, chartData, recentActivity: events.slice(0, 10) });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export const dashboardRouter = createDashboardRouter();
