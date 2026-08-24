/**
 * The admin portal's data, from the real backend. Replaces useAdminMockData.ts.
 *
 * The interfaces below are unchanged from the mock they succeed, and the API
 * returns exactly these shapes — the mapping to database columns happens in
 * backend/src/routes/admin.js, not here. That is what makes the swap a change
 * of import in each page rather than a rewrite of its markup.
 *
 * Each list is a fixed-key useAsyncData so every consumer shares one request,
 * the same pattern as useCertificates.ts. Mutations are plain functions that
 * hit the API and leave refreshing to the caller, because a page usually wants
 * to close a dialog and refresh together.
 */
export type OrgType = 'university' | 'bootcamp' | 'professional-body' | 'event'

export interface Org {
  id: string
  name: string
  type: OrgType
  website: string
  /** Path under /public or an absolute URL. Null when none is set. */
  logoUrl: string | null
  /** Public-registry listing only — independent of `status`. */
  accredited: boolean
  issuersCount: number
  certificatesCount: number
  status: 'active' | 'suspended'
  createdAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'issuer' | 'recipient' | 'admin'
  organizationId: string
  organizationName: string
  status: 'active' | 'deactivated'
  joinedAt: string
}

export interface AdminCert {
  id: string
  recipientName: string
  recipientEmail: string
  courseName: string
  organizationId: string
  organizationName: string
  completionDate: string
  expiryDate: string | null
  /** Orthogonal to `status` — a claimed certificate can still be revoked. */
  claimState: 'unclaimed' | 'claimed'
  issuedAt: string
  status: 'issued' | 'revoked'
  revokedAt?: string
}

/*
 * Every value of the `audit_action` enum — 0001_init.sql, plus
 * 'certificate.claim_resent' from 0003. The mock only knew six; a row carrying
 * one of the others rendered with an undefined label and no icon.
 */
export type AuditAction =
  | 'certificate.issued'
  | 'certificate.revoked'
  | 'certificate.reissued'
  | 'certificate.claimed'
  | 'certificate.claim_resent'
  | 'issuer.invited'
  | 'issuer.removed'
  | 'org.created'
  | 'org.suspended'
  | 'org.reactivated'

export interface AuditEvent {
  id: string
  timestamp: string
  actorName: string
  actorEmail: string
  action: AuditAction
  targetLabel: string
  organizationId: string
  organizationName: string
}

export interface AdminStats {
  totalOrgs: number
  totalCerts: number
  activeIssuers: number
  verificationsLast30: number
  monthlyCerts: Array<{ month: string; count: number }>
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  'certificate.issued': 'Certificate issued',
  'certificate.revoked': 'Certificate revoked',
  'certificate.reissued': 'Certificate reissued',
  'certificate.claimed': 'Certificate claimed',
  'certificate.claim_resent': 'Claim link resent',
  'issuer.invited': 'Issuer invited',
  'issuer.removed': 'Issuer removed',
  'org.created': 'Organization created',
  'org.suspended': 'Organization suspended',
  'org.reactivated': 'Organization reactivated',
}

export const ACTION_META: Record<AuditAction, { icon: string; tint: string }> = {
  'certificate.issued': { icon: 'i-heroicons-document-check', tint: 'green' },
  'certificate.revoked': { icon: 'i-heroicons-x-circle', tint: 'red' },
  'certificate.reissued': { icon: 'i-heroicons-arrow-path', tint: 'blue' },
  'certificate.claimed': { icon: 'i-heroicons-hand-raised', tint: 'green' },
  'certificate.claim_resent': {
    icon: 'i-heroicons-paper-airplane',
    tint: 'blue',
  },
  'issuer.invited': { icon: 'i-heroicons-user-plus', tint: 'blue' },
  'issuer.removed': { icon: 'i-heroicons-user-minus', tint: 'amber' },
  'org.created': { icon: 'i-heroicons-building-office-2', tint: 'green' },
  'org.suspended': { icon: 'i-heroicons-no-symbol', tint: 'red' },
  'org.reactivated': { icon: 'i-heroicons-check-badge', tint: 'green' },
}

/** Unknown actions must still render — the enum can grow ahead of this file. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action
}

export function actionMeta(action: string) {
  return (
    ACTION_META[action as AuditAction] ?? {
      icon: 'i-heroicons-ellipsis-horizontal-circle',
      tint: 'green',
    }
  )
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(isoDate)
}

// ── Reads ───────────────────────────────────────────────────────────────────

export function useAdminStats() {
  const api = useApi()
  return useAsyncData<AdminStats>(
    'admin:stats',
    () => api<AdminStats>('/api/admin/stats'),
    {
      default: () => ({
        totalOrgs: 0,
        totalCerts: 0,
        activeIssuers: 0,
        verificationsLast30: 0,
        monthlyCerts: [],
      }),
    },
  )
}

export function useAdminOrgs() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<Org[]>(
    'admin:orgs',
    () => api<Org[]>('/api/admin/organizations'),
    { default: () => [] },
  )
  return { orgs: data, pending, refresh, error }
}

export function useAdminUsers() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<AdminUser[]>(
    'admin:users',
    () => api<AdminUser[]>('/api/admin/users'),
    { default: () => [] },
  )
  return { users: data, pending, refresh, error }
}

export function useAdminCerts() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<AdminCert[]>(
    'admin:certs',
    () => api<AdminCert[]>('/api/admin/certificates'),
    { default: () => [] },
  )
  return { certs: data, pending, refresh, error }
}

export function useAdminAudit() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<AuditEvent[]>(
    'admin:audit',
    () => api<AuditEvent[]>('/api/admin/audit'),
    { default: () => [] },
  )
  return { auditEvents: data, pending, refresh, error }
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface NewOrganization {
  name: string
  type: OrgType
  website?: string
  logoUrl?: string
  accredited?: boolean
}

export function createOrganization(body: NewOrganization) {
  return useApi()<Org>('/api/admin/organizations', { method: 'POST', body })
}

export interface NewIssuer {
  email: string
  fullName: string
  organizationId: string
}

/**
 * Creates the account and emails an invitation. There is no self-signup for
 * issuers by design, so this is the only way one comes into being.
 *
 * The invite is sent by our own mailer (backend/src/services/email.js), not by
 * Supabase, and it links to the ordinary code-based reset page rather than
 * carrying a one-time token — so a mail scanner following it burns nothing.
 * `inviteEmailSent` is false when the backend has no email transport
 * configured; the account still exists and "Forgot password" reaches the same
 * page, so the UI has to say so rather than claim mail went out.
 */
export function inviteIssuer(body: NewIssuer) {
  return useApi()<AdminUser & { inviteEmailSent: boolean }>(
    '/api/admin/users',
    { method: 'POST', body },
  )
}

/** Partial update — only the keys passed are written. */
export function updateOrganization(
  id: string,
  patch: Partial<{
    name: string
    type: OrgType
    status: Org['status']
    website: string
    logoUrl: string | null
    accredited: boolean
  }>,
) {
  return useApi()(`/api/admin/organizations/${id}`, { method: 'PATCH', body: patch })
}

export function setOrganizationStatus(id: string, status: Org['status']) {
  return updateOrganization(id, { status })
}

/**
 * Erases the record. The hash stays on chain — nothing can remove it — so the
 * backend revokes there first, leaving the permanent half of the record honest
 * about what happened. Prefer revoke unless the row genuinely must not exist.
 */
export interface AdminIssueInput {
  organizationId: string
  studentName: string
  studentEmail: string
  courseName: string
  completionDate: string
  expiryDate?: string | null
}

/** Issue on behalf of any institution. The admin's own id is recorded as issuer. */
export function issueCertificateAsAdmin(body: AdminIssueInput) {
  return useApi()('/api/admin/certificates', { method: 'POST', body })
}

/** Correction: revokes the old hash and anchors a new one, keeping the same ID. */
export function updateCertificateAsAdmin(
  id: string,
  body: Omit<AdminIssueInput, 'organizationId'>,
) {
  return useApi()(`/api/admin/certificates/${id}`, { method: 'PUT', body })
}

export function updateUser(
  id: string,
  patch: Partial<{ fullName: string; status: AdminUser['status']; organizationId: string | null }>,
) {
  return useApi()<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: patch })
}

/**
 * Removes the auth account; the profile cascades with it. The audit trail
 * survives — actor_id nulls out but the name and email on each row do not.
 */
export function deleteUser(id: string) {
  return useApi()(`/api/admin/users/${id}`, { method: 'DELETE' })
}

/** Refused while the institution still has accounts or certificates. */
export function deleteOrganization(id: string) {
  return useApi()(`/api/admin/organizations/${id}`, { method: 'DELETE' })
}

/**
 * Same endpoint the issuer uses — it accepts an admin and, for one, is not
 * scoped to a single institution.
 */
export function resendClaimEmailAsAdmin(id: string) {
  return useApi()<import('./useCertificates').ResendClaimResult>(
    `/api/certificates/${id}/resend-claim`,
    { method: 'POST' },
  )
}

export function deleteCertificate(id: string) {
  return useApi()(`/api/admin/certificates/${id}`, { method: 'DELETE' })
}

export function setUserStatus(id: string, status: AdminUser['status']) {
  return useApi()(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: { status },
  })
}

/**
 * Platform-wide revoke. Goes through /api/admin, not the issuer route — that
 * one is scoped to the caller's own institution and refuses an admin outright.
 */
export function revokeCertificateAsAdmin(id: string, reason?: string) {
  return useApi()(`/api/admin/certificates/${id}/revoke`, {
    method: 'POST',
    body: reason ? { reason } : {},
  })
}
