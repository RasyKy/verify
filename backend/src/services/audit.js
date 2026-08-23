/**
 * Audit log (T-08, repudiation).
 *
 * The chain proves what happened to a hash; this proves WHO asked for it. Those
 * are different claims and neither substitutes for the other — the contract
 * records that hash 0xab… was revoked at block N by the platform relayer, which
 * is the only wallet that ever signs, so on its own it cannot distinguish one
 * institution's admin from another's.
 *
 * Actor email and name are DENORMALISED onto the row on purpose. A foreign key
 * alone would leave the log unreadable after the account is deleted, and
 * "deleted user revoked this certificate" is exactly the record an audit is for.
 *
 * Failing to write an audit row must never fail the operation that triggered it
 * — the certificate was already issued and the transaction already mined, so
 * throwing here would report a false failure for work that actually happened.
 * Logged loudly instead.
 */
import { adminClient as defaultAdminClient } from '../config/supabase.js';
import { logger } from '../lib/logger.js';

/** Values of the `audit_action` enum in db/migrations/0001_init.sql. */
export const AUDIT_ACTIONS = Object.freeze({
  CERTIFICATE_ISSUED: 'certificate.issued',
  CERTIFICATE_REVOKED: 'certificate.revoked',
  CERTIFICATE_REISSUED: 'certificate.reissued',
  CERTIFICATE_CLAIMED: 'certificate.claimed',
  // Requires db/migrations/0003 — writeAuditEvent swallows the enum error if
  // that migration has not been applied, so a resend still succeeds without it.
  CLAIM_RESENT: 'certificate.claim_resent',
  ISSUER_INVITED: 'issuer.invited',
  ISSUER_REMOVED: 'issuer.removed',
  ORG_CREATED: 'org.created',
  ORG_SUSPENDED: 'org.suspended',
  ORG_REACTIVATED: 'org.reactivated',
});

/**
 * @param {object} args
 * @param {string} args.action        one of AUDIT_ACTIONS
 * @param {string} args.targetLabel   human-readable subject, e.g. a student name
 * @param {object} [args.actor]       req.user
 * @param {string|null} [args.organizationId]
 * @param {object} [args.metadata]    extra context; must not contain secrets
 * @param {object} [deps]
 */
export async function writeAuditEvent(
  { action, targetLabel, actor = null, organizationId = null, metadata = {} },
  { adminClient = defaultAdminClient } = {}
) {
  try {
    const { error } = await adminClient.from('audit_events').insert({
      action,
      target_label: targetLabel,
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? null,
      actor_name: actor?.fullName ?? null,
      organization_id: organizationId,
      metadata,
    });
    if (error) throw error;
  } catch (err) {
    logger.error('failed to write audit event', {
      err,
      action,
      targetLabel,
      actorId: actor?.id ?? null,
    });
  }
}
