/**
 * A holder's public profile — the browsable list that the `is_hidden` and
 * `profile_is_public` toggles on /recipient actually govern.
 *
 * Matches GET /api/profiles/:holderId, which is public: no bearer token, so
 * pages fetch it with a plain useFetch rather than useApi(), the same way
 * pages/cert/[certId].vue fetches the public verify endpoint.
 *
 * snake_case, matching the holder dashboard's shape — with two fields
 * deliberately absent. There is no `is_hidden`, because every certificate here
 * is visible by definition, and no `student_name`, because the holder's name
 * belongs to the profile rather than to each row.
 */
export interface PublicProfileCertificate {
  id: string
  course_name: string
  institution_name: string | null
  completion_date: string
  expiry_date: string | null
  issued_at: string
  issuedAtBlockchainTimestamp: string | null
  status: 'valid' | 'revoked' | 'expired'
}

export interface PublicProfile {
  holder: {
    id: string
    display_name: string
  }
  certificates: PublicProfileCertificate[]
}

/**
 * The canonical public URL for a holder's profile.
 *
 * Takes the origin as an argument rather than calling useRequestURL() itself so
 * it stays a pure function usable from anywhere — the dashboard renders this
 * for the signed-in holder to copy, and the profile page renders it for its own
 * share control.
 */
export function publicProfileUrl(origin: string, holderId: string): string {
  return `${origin}/p/${holderId}`
}
