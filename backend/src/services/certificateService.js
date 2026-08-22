/**
 * Certificate orchestration — the layer that turns a validated request into a
 * database row, an on-chain record, and an audit trail.
 *
 * Everything it needs already existed in isolation before this module:
 * hashing (services/hash.js), status derivation (lib/derivedStatus.js), the
 * chain client (services/blockchain.js), and the schema. This is the piece
 * that puts them in the right order.
 *
 * ── Why order matters more than anything else here ──
 *
 * ISSUE writes the database row FIRST, then sends to the chain, then records
 * the transaction. The reverse would spend gas on a certificate that might
 * fail to insert, leaving a hash on an immutable ledger with nothing behind
 * it — unfixable. This way a chain failure leaves a certificate with no hash
 * row: visible, reportable, and re-issuable.
 *
 * REVOKE goes the other way — chain FIRST, then the database. A revocation the
 * database claims but the chain has not recorded is the dangerous direction:
 * the institution believes a credential is dead while every verifier still
 * sees it as live.
 *
 * ── The one-shot transaction hash ──
 *
 * blockchain/contracts/Verifier.sol emits NO events. There is no log to query,
 * so a transaction hash that is not persisted at submission time is gone for
 * good. Every chain call here therefore writes its tx hash immediately, and
 * never invents a placeholder when it does not have one — a synthetic hash
 * that 404s on a block explorer is worse than an honest null.
 */
import { adminClient, unwrap } from '../config/supabase.js';
import {
  issuerStatus,
  verifyStatus,
  ISSUER_STATUS_VALUES,
} from '../lib/derivedStatus.js';
import { conflict, notFound } from '../lib/errors.js';
import { logger, pseudonymize } from '../lib/logger.js';
import { blockchainService } from './blockchain.js';
import {
  HASH_VERSION,
  computeCertificateHash,
  expiryToUnix,
  hashFromRow,
  hashesEqual,
} from './hash.js';

/**
 * Columns the verify path must read. Listed explicitly rather than `*` because
 * every one of them is part of the hash preimage — a `select('*')` that
 * silently stopped returning a column would report genuine certificates as
 * forged, and the failure would look like tampering rather than a bug.
 */
const HASHED_COLUMNS =
  'id, student_name, course_name, completion_date, expiry_date';

/**
 * @param {object} [deps]
 * @param {import('@supabase/supabase-js').SupabaseClient} [deps.db]
 * @param {typeof blockchainService} [deps.chain]
 */
export function createCertificateService({
  db = adminClient,
  chain = blockchainService,
} = {}) {
  /**
   * Records who did what (T-08). Denormalised actor fields so the row stays
   * readable after the account is deleted.
   *
   * Deliberately non-fatal: an audit insert that fails must not roll back a
   * certificate that is already on an immutable ledger. It is logged loudly
   * instead, which is the only honest option once the chain write has landed.
   */
  async function recordAudit({ action, actor, targetLabel, metadata = {} }) {
    try {
      unwrap(
        await db.from('audit_events').insert({
          actor_id: actor?.id ?? null,
          actor_email: actor?.email ?? null,
          actor_name: actor?.fullName ?? null,
          action,
          target_label: targetLabel,
          organization_id: actor?.organizationId ?? null,
          metadata,
        }),
        `insert audit_events (${action})`
      );
    } catch (err) {
      logger.error('audit insert failed — action still happened', {
        err,
        action,
        targetLabel,
      });
    }
  }

  /**
   * Logs a public verification attempt (FR-VERIFY, T-04).
   *
   * Written even when nothing matched: a run of `not_found` rows against
   * sequential IDs is exactly the enumeration signal this table exists to
   * expose. The IP is hashed, never stored — it is personal data and the
   * analytics only need "same client or not" (T-06).
   */
  async function recordVerification({ certificateId, queriedId, result, req }) {
    try {
      unwrap(
        await db.from('verification_logs').insert({
          certificate_id: certificateId,
          queried_id: queriedId,
          result,
          ip_hash: req?.ip ? pseudonymize(req.ip) : null,
          user_agent: req?.get?.('user-agent')?.slice(0, 500) ?? null,
        }),
        'insert verification_logs'
      );
    } catch (err) {
      // Never let analytics break a verification — the answer matters, the
      // log does not.
      logger.warn('verification log insert failed', { err, queriedId });
    }
  }

  /** The single `is_current` hash row for a certificate, or null. */
  async function currentHashRow(certificateId) {
    const rows = unwrap(
      await db
        .from('certificate_hashes')
        .select('*')
        .eq('certificate_id', certificateId)
        .eq('is_current', true)
        .limit(1),
      'select current certificate_hash'
    );
    return rows?.[0] ?? null;
  }

  /**
   * Issue a certificate (FR-ISSUE-01).
   *
   * @param {object} input validated output of issueCertificateSchema
   * @param {object} actor req.user — supplies the organization, which is NEVER
   *   taken from the request body (see the note in schemas/certificate.js).
   */
  async function issue(input, actor) {
    const inserted = unwrap(
      await db
        .from('certificates')
        .insert({
          organization_id: actor.organizationId,
          issuer_id: actor.id,
          student_name: input.studentName,
          student_email: input.studentEmail,
          course_name: input.courseName,
          completion_date: input.completionDate,
          expiry_date: input.expiryDate,
        })
        .select()
        .single(),
      'insert certificate'
    );

    const hash = computeCertificateHash({
      certId: inserted.id,
      studentName: inserted.student_name,
      courseName: inserted.course_name,
      completionDate: inserted.completion_date,
      expiryDate: inserted.expiry_date,
    });
    const expiresAtUnix = expiryToUnix(inserted.expiry_date);

    let chainResult;
    try {
      chainResult = await chain.issue(hash, expiresAtUnix);
    } catch (err) {
      // The row exists but has no hash: it is not verifiable and must not be
      // presented as though it were. Remove it so the issuer can retry cleanly
      // rather than being left with a permanently broken certificate.
      await db.from('certificates').delete().eq('id', inserted.id);
      throw err;
    }

    const hashRow = unwrap(
      await db
        .from('certificate_hashes')
        .insert({
          certificate_id: inserted.id,
          hash,
          hash_version: HASH_VERSION,
          expires_at_unix: expiresAtUnix,
          issue_tx_hash: chainResult.txHash,
          chain_issued_at: chainResult.blockTimestamp,
          chain_status: chainResult.status,
          is_current: true,
        })
        .select()
        .single(),
      'insert certificate_hash'
    );

    await recordAudit({
      action: 'certificate.issued',
      actor,
      targetLabel: `${inserted.student_name} — ${inserted.course_name}`,
      metadata: { certificate_id: inserted.id, hash, tx: chainResult.txHash },
    });

    return { ...inserted, status: issuerStatus(inserted), hash: hashRow };
  }

  /**
   * Public verification (FR-VERIFY-04).
   *
   * Returns a status for every input, including garbage — the public page must
   * render an answer, never an error. The only exception is an unreachable
   * chain, which propagates as a 503 from the blockchain service: reporting a
   * genuine certificate as invalid because Alchemy blinked is the single worst
   * outcome this system can produce.
   */
  async function verifyByCertId(certId, req) {
    const rows = unwrap(
      await db
        .from('certificates')
        .select(
          `${HASHED_COLUMNS}, revoked_at, is_hidden, organization_id,
           organizations ( name )`
        )
        .eq('id', certId)
        .limit(1),
      'select certificate for verification'
    );
    const cert = rows?.[0];

    if (!cert) {
      await recordVerification({
        certificateId: null,
        queriedId: certId,
        result: 'not_found',
        req,
      });
      return { status: 'invalid', certificate: null };
    }

    const hashRow = await currentHashRow(cert.id);
    // A certificate with no hash row was never anchored — treat it as invalid
    // rather than crashing. (issue() cleans these up, but a partial failure
    // from an older run could still leave one.)
    if (!hashRow) {
      await recordVerification({
        certificateId: cert.id,
        queriedId: certId,
        result: 'invalid',
        req,
      });
      return { status: 'invalid', certificate: null };
    }

    const recomputed = hashFromRow(cert);
    const hashMatches = hashesEqual(recomputed, hashRow.hash);

    const onChain = await chain.verify(hashRow.hash);

    const status = verifyStatus({
      existsOnChain: onChain.exists,
      hashMatches,
      revokedOnChain: onChain.revoked,
      revokedAt: cert.revoked_at,
      expiryDate: cert.expiry_date,
    });

    if (!hashMatches) {
      // The stored data no longer produces the hash that was anchored. This is
      // the tamper signal the whole design exists to catch — log it loudly.
      logger.error('certificate hash mismatch — data altered since issuance', {
        certificateId: cert.id,
        stored: hashRow.hash,
        recomputed,
      });
    }

    await recordVerification({
      certificateId: cert.id,
      queriedId: certId,
      result: status === 'verified' ? 'verified' : status,
      req,
    });

    // PII is returned only for a certificate that actually verifies. An
    // invalid result must not become a way to read student data out of a
    // tampered row.
    if (status === 'invalid') {
      return { status, certificate: null };
    }

    return {
      status,
      certificate: {
        cert_id: cert.id,
        student_name: cert.student_name,
        course_name: cert.course_name,
        institution_name: cert.organizations?.name ?? null,
        completion_date: cert.completion_date,
        expiry_date: cert.expiry_date,
        issued_at_blockchain: hashRow.chain_issued_at,
        hash: hashRow.hash,
        issue_tx_hash: hashRow.issue_tx_hash,
      },
    };
  }

  /**
   * Revoke (FR-MGMT-03). Chain first — see the header note on ordering.
   */
  async function revoke(certId, actor, reason) {
    const rows = unwrap(
      await db
        .from('certificates')
        .select('id, student_name, course_name, organization_id, revoked_at')
        .eq('id', certId)
        .limit(1),
      'select certificate for revocation'
    );
    const cert = rows?.[0];
    if (!cert) throw notFound('Certificate not found.');

    // Admins act platform-wide; an issuer is confined to its own institution.
    if (
      actor.role !== 'admin' &&
      cert.organization_id !== actor.organizationId
    ) {
      throw notFound('Certificate not found.');
    }
    if (cert.revoked_at) {
      throw conflict('This certificate has already been revoked.');
    }

    const hashRow = await currentHashRow(cert.id);
    if (!hashRow) {
      throw conflict('This certificate has no on-chain record to revoke.');
    }

    const chainResult = await chain.revoke(hashRow.hash);

    const now = new Date().toISOString();
    unwrap(
      await db
        .from('certificates')
        .update({
          revoked_at: now,
          revoked_by: actor.id,
          revoke_reason: reason ?? null,
        })
        .eq('id', cert.id),
      'update certificate revoked_at'
    );
    unwrap(
      await db
        .from('certificate_hashes')
        .update({ revoke_tx_hash: chainResult.txHash, revoked_at: now })
        .eq('id', hashRow.id),
      'update certificate_hash revoke_tx_hash'
    );

    await recordAudit({
      action: 'certificate.revoked',
      actor,
      targetLabel: `${cert.student_name} — ${cert.course_name}`,
      metadata: {
        certificate_id: cert.id,
        reason: reason ?? null,
        tx: chainResult.txHash,
      },
    });

    return { id: cert.id, status: 'revoked', tx_hash: chainResult.txHash };
  }

  /**
   * Issuer's certificate list.
   *
   * Status is filtered AFTER derivation because no stored column matches these
   * values — the schema deliberately has no `status` column, since a stored one
   * would go stale the day a certificate expires.
   */
  async function list(actor, { status, search, limit, offset }) {
    let query = db
      .from('certificates')
      .select('*, organizations ( name )')
      .order('created_at', { ascending: false });

    if (actor.role !== 'admin') {
      query = query.eq('organization_id', actor.organizationId);
    }
    if (search) {
      // Escape the PostgREST or() delimiters — an unescaped comma or paren in
      // a search box would otherwise be parsed as extra filter syntax.
      const safe = search.replace(/[,()]/g, ' ');
      query = query.or(
        `student_name.ilike.%${safe}%,course_name.ilike.%${safe}%,student_email.ilike.%${safe}%`
      );
    }

    const rows = unwrap(await query, 'select certificates') ?? [];
    const withStatus = rows.map((row) => ({
      ...row,
      institution_name: row.organizations?.name ?? null,
      status: issuerStatus(row),
    }));

    const filtered =
      status && ISSUER_STATUS_VALUES.includes(status)
        ? withStatus.filter((row) => row.status === status)
        : withStatus;

    return {
      total: filtered.length,
      certificates: filtered.slice(offset, offset + limit),
    };
  }

  /** Single certificate for the issuer detail modal. */
  async function getById(certId, actor) {
    const rows = unwrap(
      await db
        .from('certificates')
        .select('*, organizations ( name )')
        .eq('id', certId)
        .limit(1),
      'select certificate'
    );
    const cert = rows?.[0];
    if (!cert) throw notFound('Certificate not found.');
    if (
      actor.role !== 'admin' &&
      cert.organization_id !== actor.organizationId
    ) {
      // 404 rather than 403: confirming a certificate exists in another
      // institution is itself a small leak.
      throw notFound('Certificate not found.');
    }

    const hashRow = await currentHashRow(cert.id);
    return {
      ...cert,
      institution_name: cert.organizations?.name ?? null,
      status: issuerStatus(cert),
      hash: hashRow,
    };
  }

  return { issue, verifyByCertId, revoke, list, getById };
}

/** Process-wide instance used by the router's default export. */
export const certificateService = createCertificateService();
