/**
 * Transactional email (Resend, or SMTP — see "Two transports" below).
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
 * When no transport is configured the whole thing is a no-op that logs the
 * claim URL, so the claim flow stays testable locally without sending real mail
 * to the seeded @example.com addresses.
 *
 * ── Two transports, one interface ──
 * Resend needs a verified sending domain; without one its shared sender
 * delivers only to the Resend account owner's own address, so no real recipient
 * can be tested. SMTP against a Gmail app password (SMTP_USER + SMTP_PASSWORD)
 * is the way around that with no domain: the mail is genuinely sent by Gmail,
 * so it aligns and reaches anyone. `env.emailTransport` picks between them and
 * `smtpAdapter` makes the SMTP side speak the Resend SDK's shape, so
 * everything below this line is provider-agnostic.
 *
 * ── The Resend SDK does not throw ──
 *
 * `emails.send()` resolves with `{ data, error }` and reports EVERYTHING that
 * way — a 403 for an unverified sending domain, a 422, a rate limit, even a
 * dead socket (see fetchRequest in resend/dist). A bare `await` inside a
 * try/catch therefore only ever sees the happy path, and every one of these
 * functions would report `{ sent: true }` for mail the provider refused
 * outright. The `error` field has to be read explicitly. The try/catch stays
 * for genuine programmer errors, not for delivery failures.
 */
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 587 is STARTTLS: connect in the clear, then upgrade. Only 465 is TLS
    // from the first byte. Setting `secure` by port keeps both working.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

/**
 * SMTP transport wearing the Resend SDK's interface.
 *
 * Both senders below were written against `{ emails: { send } }` resolving to
 * `{ data, error }`, and their tests inject a stub of exactly that shape. So
 * the adapter is here rather than a second code path through each sender: a
 * refused SMTP send has to surface the same way a refused Resend send does, or
 * the explicit `error` check that this whole module exists to get right would
 * apply to only one of the two providers.
 *
 * nodemailer DOES throw, which is the opposite convention, so the rejection is
 * translated into an `error` object rather than left to propagate.
 *
 * `transporter` is injectable purely so those translations can be tested
 * without opening a socket; production always uses the default.
 */
export function smtpAdapter(transporter = createTransporter()) {
  return {
    emails: {
      async send({ from, to, subject, html }) {
        try {
          const info = await transporter.sendMail({ from, to, subject, html });
          // A 2xx from the server with the recipient in `rejected` is a
          // per-recipient refusal, not a transport failure — sendMail resolves
          // for it. Treated as an error so it cannot report itself as sent.
          if (info.rejected?.length) {
            return {
              data: null,
              error: {
                name: 'smtp_rejected',
                statusCode: info.responseCode ?? 0,
                message: `recipient refused: ${info.rejected.join(', ')}`,
              },
            };
          }
          return { data: { id: info.messageId }, error: null };
        } catch (err) {
          return {
            data: null,
            error: {
              // 535 here is almost always the app password: a plain account
              // password, or one pasted with its display spaces intact.
              name: err.code ?? 'smtp_error',
              statusCode: err.responseCode ?? 0,
              message: err.message,
            },
          };
        }
      },
    },
  };
}

let client;
function getClient() {
  // `sendExpiryReminderEmail` calls this from a default parameter, which
  // evaluates before the function body reaches its emailEnabled gate. The
  // Resend constructor throws on a missing key, so with no transport at all —
  // the normal local state — constructing one here would turn a send that is
  // supposed to be a logged no-op into a thrown error inside the expiry cron.
  if (!env.emailTransport)
    return { emails: { send: () => Promise.resolve({}) } };
  client ??=
    env.emailTransport === 'smtp'
      ? smtpAdapter()
      : new Resend(env.RESEND_API_KEY);
  return client;
}

/** The URL the student opens to claim. Must match the claim page's route. */
export function buildClaimUrl(token) {
  return `${env.publicAppUrl}/claim/${token}`;
}

function claimEmailHtml({
  studentName,
  courseName,
  institutionName,
  claimUrl,
}) {
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

function expiryReminderEmailHtml({
  studentName,
  courseName,
  institutionName,
  expiryDate,
}) {
  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#111827">
      <h1 style="font-size:18px;font-weight:600">Your certificate expires in 60 days</h1>
      <p style="font-size:14px;line-height:1.6;color:#374151">
        Hi ${escapeHtml(studentName)},<br /><br />
        Your certificate from ${escapeHtml(institutionName)} for
        <strong>${escapeHtml(courseName)}</strong> will expire on
        <strong>${escapeHtml(expiryDate)}</strong>.
      </p>
      <p style="font-size:12px;color:#6b7280;line-height:1.6">
        No action is needed if this expiry is expected. If you believe this is
        a mistake, contact the issuing institution directly.
      </p>
    </div>
  `;
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
    const { error } = await getClient().emails.send({
      from: env.mailFrom,
      to,
      subject: `Your certificate from ${institutionName}`,
      html: claimEmailHtml({
        studentName,
        courseName,
        institutionName,
        claimUrl,
      }),
    });
    if (error) {
      logger.error('claim email rejected by provider', {
        to,
        name: error.name,
        statusCode: error.statusCode,
        reason: error.message,
      });
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    logger.error('claim email failed to send', { err, to });
    return { sent: false };
  }
}

/**
 * FR-EXP-03. Mirrors sendClaimEmail's shape and guarantees: gated on
 * emailEnabled, never rejects, logs + swallows any send failure.
 *
 * `client`/`emailEnabled` are optional overrides purely for tests — there is
 * no other seam into the module-level Resend singleton, and unlike
 * sendClaimEmail this function has dedicated unit tests that exercise the
 * gate and the error path deterministically, without a live network call.
 *
 * @param {object} args
 * @param {string} args.to
 * @param {string} args.studentName
 * @param {string} args.courseName
 * @param {string} args.institutionName
 * @param {string} args.expiryDate     YYYY-MM-DD
 * @returns {Promise<{ sent: boolean }>} never rejects
 */
export async function sendExpiryReminderEmail({
  to,
  studentName,
  courseName,
  institutionName,
  expiryDate,
  emailEnabled = env.emailEnabled,
  client = getClient(),
}) {
  if (!emailEnabled) {
    logger.info('email disabled — expiry reminder not sent', {
      to,
      expiryDate,
    });
    return { sent: false };
  }

  try {
    const { error } = await client.emails.send({
      from: env.mailFrom,
      to,
      subject: `Your certificate from ${institutionName} expires soon`,
      html: expiryReminderEmailHtml({
        studentName,
        courseName,
        institutionName,
        expiryDate,
      }),
    });
    if (error) {
      logger.error('expiry reminder rejected by provider', {
        to,
        name: error.name,
        statusCode: error.statusCode,
        reason: error.message,
      });
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    logger.error('expiry reminder email failed to send', { err, to });
    return { sent: false };
  }
}
