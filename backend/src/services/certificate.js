/**
 * Certificate orchestration — issue, list, edit, revoke, verify.
 *
 * This is the layer that knows the ORDER things must happen in. The pieces it
 * coordinates (hashing, the chain, status derivation) are each already built and
 * tested in isolation; what lives here is the sequencing and the failure
 * handling, which is where the interesting decisions are:
 *
 * ── The chain is written BEFORE the database ──
 * The certificate UUID is generated here rather than by Postgres, because the
 * UUID is the first field of the canonical string (services/hash.js) — the hash
 * cannot exist until the ID does. Generating it up front lets the whole sequence
 * be: id → hash → chain → database. If the chain rejects the write we return 503
 * and nothing was ever stored, instead of leaving a certificate row that no
 * verification could ever match. The reverse order's failure mode — a row in the
 * database with no hash on chain — reads as a FORGED certificate, which is the
 * worst output this system can produce.
 *
 * ── "Edit" is revoke-then-reissue, and the UUID does not change ──
 * FR-MGMT-04 is presented as an edit. A hash is immutable by construction, so
 * changing a name means revoking the old hash and issuing a new one. The
 * certificate UUID is deliberately preserved so QR codes and links already in
 * circulation keep resolving (db/migrations/0001_init.sql:17-20).
 *
 * ── A chain outage is never a verification failure ──
 * `verify` lets `upstreamUnavailable` propagate as a 503. Collapsing it into
 * `invalid` would report a genuine certificate as fake because a node provider
 * blipped (docs/api-schema.md:38-41).
 */
import crypto from 'node:crypto';

import {
  adminClient as defaultAdminClient,
  unwrap,
} from '../config/supabase.js';
import { conflict, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { issuerStatus, todayUtc, verifyStatus } from '../lib/derivedStatus.js';
import {
  HASH_VERSION,
  computeCertificateHash,
  expiryToUnix,
  hashFromRow,
  hashesEqual,
} from './hash.js';
import { blockchainService } from './blockchain.js';
import { sendClaimEmail as defaultSendClaimEmail } from './email.js';
import { AUDIT_ACTIONS, writeAuditEvent } from './audit.js';

/** Claim links are single-use and short-lived (FR-AUTH-03). */
const CLAIM_TOKEN_TTL_DAYS = 7;

/**
 * Columns the issuer surfaces need, plus the organization name the table
 * renders. `issued_at` is not a column — `created_at` is the issuance moment.
 */
const CERT_SELECT = `
  id, organization_id, issuer_id, holder_id,
  student_name, student_email, course_name, course_id,
  completion_date, expiry_date,
  claim_state, claimed_at,
  revoked_at, revoke_reason, is_hidden,
  created_at,
  organizations ( name )
`;

/**
 * Maps a row onto the snake_case shape the issuer table and modals destructure
 * (frontend/app/composables/useIssuerMockData.ts). Status is derived here and
 * never read from a column — there isn't one.
 */
export function toIssuerShape(row, now = new Date()) {
  return {
    id: row.id,
    student_name: row.student_name,
    student_email: row.student_email,
    course_name: row.course_name,
    completion_date: row.completion_date,
    expiry_date: row.expiry_date,
    status: issuerStatus(row, now),
    institution_id: row.organization_id,
    institution_name: row.organizations?.name ?? null,
    issued_at: row.created_at,
    revoked_at: row.revoked_at,
  };
}

/**
 * Translates a derived status into database predicates.
 *
 * Deriving in JavaScript and filtering afterwards would silently break
 * pagination — `limit` would apply before the filter, so page 2 of "revoked"
 * could be empty while more revoked rows existed. These four predicates
 * reproduce issuerStatus() exactly (lib/derivedStatus.js:49).
 */
function applyStatusFilter(query, status, today) {
  switch (status) {
    case 'revoked':
      return query.not('revoked_at', 'is', null);
    case 'expired':
      return query.is('revoked_at', null).lt('expiry_date', today);
    case 'unclaimed':
      return query
        .is('revoked_at', null)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`)
        .eq('claim_state', 'unclaimed');
    case 'valid':
      return query
        .is('revoked_at', null)
        .or(`expiry_date.is.null,expiry_date.gte.${today}`)
        .eq('claim_state', 'claimed');
    default:
      return query;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** sha256 of the raw token. Only the digest is stored (matches scripts/seed.js). */
function hashClaimToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createCertificateService({
  adminClient = defaultAdminClient,
  chain = blockchainService,
  sendClaimEmail = defaultSendClaimEmail,
  audit = writeAuditEvent,
} = {}) {
  /** The live hash row for a certificate. */
  async function currentHashRow(certificateId) {
    return unwrap(
      await adminClient
        .from('certificate_hashes')
        .select('*')
        .eq('certificate_id', certificateId)
        .eq('is_current', true)
        .maybeSingle(),
      'load current hash'
    );
  }

  /**
   * Finds or creates the org's course by name.
   *
   * Idempotent because the typeahead can fire twice on a fast double-click and
   * `courses_unique_per_org` would reject the second insert. Certificates carry
   * a text snapshot of the course name regardless, so a failure here costs the
   * typeahead an entry and nothing more — never the issuance.
   */
  async function ensureCourse(organizationId, name, actorId) {
    try {
      const existing = unwrap(
        await adminClient
          .from('courses')
          .select('id, name')
          .eq('organization_id', organizationId)
          .eq('name', name)
          .maybeSingle(),
        'find course'
      );
      if (existing) return existing;

      const created = unwrap(
        await adminClient
          .from('courses')
          .insert({
            organization_id: organizationId,
            name,
            created_by: actorId ?? null,
          })
          .select('id, name')
          .single(),
        'create course'
      );
      return created;
    } catch (err) {
      logger.warn('could not link course', { err, organizationId, name });
      return null;
    }
  }

  async function list({
    organizationId,
    status,
    search,
    limit = 200,
    offset = 0,
    now = new Date(),
  }) {
    let query = adminClient
      .from('certificates')
      .select(CERT_SELECT)
      .eq('organization_id', organizationId);

    query = applyStatusFilter(query, status, todayUtc(now));

    if (search) {
      // The table's search box matches on recipient name or certificate ID.
      // `ilike` against a uuid column is a type error in Postgres, so an ID
      // search is an exact match and only attempted when the term looks like one.
      query = UUID_RE.test(search)
        ? query.eq('id', search)
        : query.or(
            `student_name.ilike.%${search}%,course_name.ilike.%${search}%,student_email.ilike.%${search}%`
          );
    }

    const rows = unwrap(
      await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      'list certificates'
    );

    return (rows ?? []).map((row) => toIssuerShape(row, now));
  }

  async function getById({ id, organizationId, now = new Date() }) {
    const row = unwrap(
      await adminClient
        .from('certificates')
        .select(CERT_SELECT)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .maybeSingle(),
      'get certificate'
    );
    if (!row) throw notFound('Certificate not found.');
    return toIssuerShape(row, now);
  }

  /**
   * FR-ISSUE-01..07.
   *
   * @param {object} args
   * @param {object} args.input  validated body (camelCase, `institution` stripped)
   * @param {object} args.user   req.user — supplies the organization
   */
  async function issue({ input, user }) {
    const {
      studentName,
      studentEmail,
      courseName,
      completionDate,
      expiryDate,
    } = input;

    // Generated here, not by Postgres: the hash covers this ID, so it has to
    // exist before the hash does. See the header note.
    const certId = crypto.randomUUID();
    const hash = computeCertificateHash({
      certId,
      studentName,
      courseName,
      completionDate,
      expiryDate,
    });
    const expiresAtUnix = expiryToUnix(expiryDate);

    // Chain first. A 503 from here leaves nothing behind to clean up.
    const chainResult = await chain.issue(hash, expiresAtUnix);

    const course = await ensureCourse(user.organizationId, courseName, user.id);

    unwrap(
      await adminClient.from('certificates').insert({
        id: certId,
        organization_id: user.organizationId,
        issuer_id: user.id,
        student_name: studentName,
        student_email: studentEmail,
        course_name: courseName,
        course_id: course?.id ?? null,
        completion_date: completionDate,
        expiry_date: expiryDate,
      }),
      'insert certificate'
    );

    unwrap(
      await adminClient.from('certificate_hashes').insert({
        certificate_id: certId,
        hash,
        hash_version: HASH_VERSION,
        expires_at_unix: expiresAtUnix,
        issue_tx_hash: chainResult.txHash,
        chain_issued_at: chainResult.blockTimestamp,
        chain_status: chainResult.status,
        is_current: true,
      }),
      'insert certificate hash'
    );

    // Claim token + email. Both are best-effort: the certificate is already
    // issued and verifiable, so neither may fail the request.
    const token = crypto.randomBytes(32).toString('hex');
    let claimEmailSent = false;
    try {
      const expiresAt = new Date(
        Date.now() + CLAIM_TOKEN_TTL_DAYS * 86_400_000
      ).toISOString();
      unwrap(
        await adminClient.from('claim_tokens').insert({
          certificate_id: certId,
          token_hash: hashClaimToken(token),
          expires_at: expiresAt,
          sent_to: studentEmail,
        }),
        'insert claim token'
      );

      const institutionName = await organizationName(user.organizationId);
      ({ sent: claimEmailSent } = await sendClaimEmail({
        to: studentEmail,
        token,
        studentName,
        courseName,
        institutionName,
      }));
    } catch (err) {
      logger.error('claim token/email step failed after issuance', {
        err,
        certId,
      });
    }

    await audit({
      action: AUDIT_ACTIONS.CERTIFICATE_ISSUED,
      targetLabel: studentName,
      actor: user,
      organizationId: user.organizationId,
      metadata: { certificateId: certId, courseName },
    });

    return {
      id: certId,
      status: 'unclaimed',
      hash,
      issue_tx_hash: chainResult.txHash,
      chain_status: chainResult.status,
      claim_email_sent: claimEmailSent,
    };
  }

  async function organizationName(organizationId) {
    const org = unwrap(
      await adminClient
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle(),
      'load organization name'
    );
    return org?.name ?? 'Your institution';
  }

  /**
   * FR-MGMT-04 — presented as an edit, implemented as revoke-then-reissue.
   * The certificate UUID is preserved.
   */
  async function update({ id, input, user }) {
    const row = unwrap(
      await adminClient
        .from('certificates')
        .select('id, organization_id, revoked_at, student_name')
        .eq('id', id)
        .eq('organization_id', user.organizationId)
        .maybeSingle(),
      'load certificate for update'
    );
    if (!row) throw notFound('Certificate not found.');
    if (row.revoked_at) {
      throw conflict('This certificate has been revoked and cannot be edited.');
    }

    const previous = await currentHashRow(id);
    const { studentName, courseName, completionDate, expiryDate } = input;

    const newHash = computeCertificateHash({
      certId: id,
      studentName,
      courseName,
      completionDate,
      expiryDate,
    });
    const expiresAtUnix = expiryToUnix(expiryDate);

    // Both chain writes before any database write, for the same reason issuance
    // orders them that way.
    let revokeResult = { txHash: null };
    if (previous) revokeResult = await chain.revoke(previous.hash);
    const issueResult = await chain.issue(newHash, expiresAtUnix);

    const course = await ensureCourse(user.organizationId, courseName, user.id);

    unwrap(
      await adminClient
        .from('certificates')
        .update({
          student_name: studentName,
          student_email: input.studentEmail,
          course_name: courseName,
          course_id: course?.id ?? null,
          completion_date: completionDate,
          expiry_date: expiryDate,
        })
        .eq('id', id),
      'update certificate'
    );

    if (previous) {
      // Must clear the old row first: a partial unique index permits only one
      // is_current row per certificate (0001_init.sql:262).
      unwrap(
        await adminClient
          .from('certificate_hashes')
          .update({
            is_current: false,
            revoked_at: new Date().toISOString(),
            revoke_tx_hash: revokeResult.txHash,
          })
          .eq('id', previous.id),
        'retire previous hash'
      );
    }

    unwrap(
      await adminClient.from('certificate_hashes').insert({
        certificate_id: id,
        hash: newHash,
        hash_version: HASH_VERSION,
        expires_at_unix: expiresAtUnix,
        issue_tx_hash: issueResult.txHash,
        chain_issued_at: issueResult.blockTimestamp,
        chain_status: issueResult.status,
        is_current: true,
      }),
      'insert reissued hash'
    );

    await audit({
      action: AUDIT_ACTIONS.CERTIFICATE_REISSUED,
      targetLabel: studentName,
      actor: user,
      organizationId: user.organizationId,
      metadata: { certificateId: id, previousHash: previous?.hash ?? null },
    });

    return {
      id,
      hash: newHash,
      previous_hash: previous?.hash ?? null,
      revoke_tx_hash: revokeResult.txHash,
      issue_tx_hash: issueResult.txHash,
    };
  }

  /** FR-MGMT-03. */
  async function revoke({ id, reason = null, user, organizationId = null }) {
    const scopeOrg = organizationId ?? user.organizationId;

    let query = adminClient
      .from('certificates')
      .select('id, organization_id, revoked_at, student_name')
      .eq('id', id);
    // An admin revoking on behalf of the platform is not scoped to one org.
    if (scopeOrg) query = query.eq('organization_id', scopeOrg);

    const row = unwrap(
      await query.maybeSingle(),
      'load certificate for revoke'
    );
    if (!row) throw notFound('Certificate not found.');
    if (row.revoked_at) {
      throw conflict('This certificate has already been revoked.');
    }

    const current = await currentHashRow(id);
    let txHash = null;
    if (current) ({ txHash } = await chain.revoke(current.hash));

    const revokedAt = new Date().toISOString();

    unwrap(
      await adminClient
        .from('certificates')
        .update({
          revoked_at: revokedAt,
          revoked_by: user.id,
          revoke_reason: reason,
        })
        .eq('id', id),
      'revoke certificate'
    );

    if (current) {
      unwrap(
        await adminClient
          .from('certificate_hashes')
          .update({ revoked_at: revokedAt, revoke_tx_hash: txHash })
          .eq('id', current.id),
        'record hash revocation'
      );
    }

    await audit({
      action: AUDIT_ACTIONS.CERTIFICATE_REVOKED,
      targetLabel: row.student_name,
      actor: user,
      organizationId: row.organization_id,
      metadata: { certificateId: id, reason },
    });

    return {
      id,
      status: 'revoked',
      revoked_at: revokedAt,
      revoke_tx_hash: txHash,
    };
  }

  /**
   * Public verification (FR-VERIFY-01..05).
   *
   * Recomputes the hash from what is stored and asks the registry whether that
   * exact value was ever issued. Both "no such certificate" and "hash mismatch"
   * return `invalid` with `certificate: null` — a verifier learns the credential
   * cannot be trusted without learning which failure occurred, so the response
   * cannot be used to probe for which IDs exist (T-05).
   *
   * Ignores `is_hidden` entirely: hiding a certificate from a public profile
   * must not make it unverifiable by direct link (FR-HOLD-07).
   */
  async function verify({ certId, now = new Date() }) {
    const row = unwrap(
      await adminClient
        .from('certificates')
        .select(CERT_SELECT)
        .eq('id', certId)
        .maybeSingle(),
      'load certificate for verification'
    );

    if (!row) return { status: 'invalid', certificate: null };

    const stored = await currentHashRow(certId);
    const recomputed = hashFromRow(row);

    // Let a chain outage propagate as 503 — never as `invalid`.
    const onChain = await chain.verify(recomputed);

    const hashMatches = Boolean(stored) && hashesEqual(recomputed, stored.hash);

    const status = verifyStatus(
      {
        existsOnChain: onChain.exists,
        hashMatches,
        revokedOnChain: onChain.revoked,
        revokedAt: row.revoked_at,
        expiryDate: row.expiry_date,
      },
      now
    );

    if (status === 'invalid') return { status, certificate: null };

    return {
      status,
      certificate: {
        studentName: row.student_name,
        courseName: row.course_name,
        institutionName: row.organizations?.name ?? null,
        completionDate: row.completion_date,
        expiryDate: row.expiry_date,
        certId: row.id,
        issuedAtBlockchainTimestamp: onChain.issuedAt
          ? new Date(onChain.issuedAt * 1000).toISOString()
          : (stored?.chain_issued_at ?? null),
      },
    };
  }

  /**
   * Records a verification attempt. Fire-and-forget: this feeds the admin
   * dashboard's `verificationsLast30`, and losing a row there must never turn a
   * successful verification into an error.
   */
  async function logVerification({ certId, result, ipHash, userAgent }) {
    try {
      const { error } = await adminClient.from('verification_logs').insert({
        certificate_id: UUID_RE.test(certId) ? certId : null,
        queried_id: certId,
        result,
        ip_hash: ipHash ?? null,
        user_agent: userAgent ?? null,
      });
      if (error) throw error;
    } catch (err) {
      logger.warn('could not write verification log', { err });
    }
  }

  return {
    list,
    getById,
    issue,
    update,
    revoke,
    verify,
    logVerification,
    currentHashRow,
    ensureCourse,
  };
}

/** Process-wide instance used by the routes. */
export const certificateService = createCertificateService();
