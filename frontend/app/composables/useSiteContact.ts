/**
 * Where the public pages send people.
 *
 * ⚠ PLACEHOLDERS. These addresses follow the `verify.app` domain the landing
 * page already claims as canonical (see the `ogUrl` in pages/index.vue), but
 * none of them is a real inbox yet. Point them at mailboxes that exist before
 * this goes in front of anyone — a contact page listing an address that bounces
 * is worse than one that admits it has no support channel.
 *
 * Kept in one module because the contact page, both legal pages and the footer
 * all cite them, and four copies of an address is four places to miss when it
 * changes.
 */
export const SITE_CONTACT = {
  /** General questions from anyone — holders included. */
  support: 'support@verify.app',
  /** Institutions asking to be onboarded or accredited. */
  institutions: 'institutions@verify.app',
  /** Data-protection requests: access, correction, deletion. */
  privacy: 'privacy@verify.app',
  /** Vulnerability reports. Kept separate so they are not lost in support. */
  security: 'security@verify.app',
} as const

/** Response-time commitment quoted on the contact page. */
export const SUPPORT_RESPONSE_DAYS = 2
