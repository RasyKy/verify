-- ── 0003 — reissuing a claim link ───────────────────────────────────────────
--
-- Adds the audit action written by POST /api/certificates/:id/resend-claim.
--
-- Nothing else has to change: 0001 already anticipated this. The raw claim
-- token exists only inside the email that carries it (claim_tokens stores the
-- sha256), so a mail that never arrives leaves a certificate that can never be
-- claimed — and `claim_tokens_one_active_idx` was written for exactly this
-- recovery, permitting one unused token per certificate so a reissue must
-- retire the old link rather than leave two ways in.
--
-- Re-runnable. ADD VALUE is allowed inside a transaction on PG 12+ as long as
-- the new value is not also USED there, which is why this file adds it and
-- nothing else.

alter type audit_action add value if not exists 'certificate.claim_resent';
