/**
 * Transactional email (Resend).
 *
 * Only one message matters right now: the claim link that turns an issued
 * certificate into an account the student controls (FR-CLAIM-01).
 *
 * ── Why a failure here never fails an issuance ──
 * By the time we send, the hash is on chain and the row is in the database. The
 * certificate genuinely exists and is genuinely verifiable. Reporting the
 * issuance as failed because a third-party mail API was slow would be a lie, and
 * would tempt the issuer to submit the form again — producing a duplicate
 * certificate with a different UUID. So `sendClaimEmail` resolves with
 * `{ sent: false }` rather than throwing, and the caller surfaces that as
 * `claim_email_sent: false`.
 *
 * When RESEND_API_KEY is absent the whole thing is a no-op that logs the claim
 * URL, so the claim flow stays testable locally without sending real mail to the
 * seeded @example.com addresses.
 */
import { Resend } from 'resend';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let client;
function getClient() {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/** The URL the student opens to claim. Must match the claim page's route. */
export function buildClaimUrl(token) {
  return `${env.publicAppUrl}/claim/${token}`;
}

function claimEmailHtml({ studentName, courseName, institutionName, claimUrl }) {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#111827">
      <h1 style="font-size:18px;font-weight:600">Your certificate is ready</h1>
      <p style="font-size:14px;line-height:1.6;color:#374151">
        Hi ${escapeHtml(studentName)},<br /><br />
        ${escapeHtml(institutionName)} has issued you a verified certificate for
        <strong>${escapeHtml(courseName)}</strong>.
      </p>
      <p style="margin:24px 0">
        <a href="${claimUrl}"
           style="background:#0d9488;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block">
          Claim your certificate
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;line-height:1.6">
        This link expires in 7 days and can only be used once.
        If you were not expecting this, you can ignore this email.
      </p>
    </div>
  `;
}

/** Minimal escaping — these values are user-supplied and land in an HTML body. */
function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

/**
 * @param {object} args
 * @param {string} args.to
 * @param {string} args.token       raw claim token (never the stored hash)
 * @param {string} args.studentName
 * @param {string} args.courseName
 * @param {string} args.institutionName
 * @returns {Promise<{ sent: boolean }>} never rejects
 */
export async function sendClaimEmail({
  to,
  token,
  studentName,
  courseName,
  institutionName,
}) {
  const claimUrl = buildClaimUrl(token);

  if (!env.emailEnabled) {
    // The URL carries a live token, so this is deliberately gated on email being
    // disabled — i.e. local development only.
    logger.info('email disabled — claim link not sent', { to, claimUrl });
    return { sent: false };
  }

  try {
    await getClient().emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: `Your certificate from ${institutionName}`,
      html: claimEmailHtml({
        studentName,
        courseName,
        institutionName,
        claimUrl,
      }),
    });
    return { sent: true };
  } catch (err) {
    logger.error('claim email failed to send', { err, to });
    return { sent: false };
  }
}
