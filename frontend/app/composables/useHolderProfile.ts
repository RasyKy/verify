/**
 * The signed-in holder's own profile visibility (FR-HOLD-04/05), from the
 * real backend (GET/PATCH /api/holder/profile). Same fixed-key useAsyncData
 * pattern as useHolderCertificates.ts.
 */
export interface HolderProfile {
  profile_is_public: boolean
}

export function useHolderProfile() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<HolderProfile>('holder:profile', () =>
    api<HolderProfile>('/api/holder/profile'),
  )
  return { profile: data, pending, refresh, error }
}

/** Server is the source of truth — caller refetches after this resolves. */
export function setProfileVisibility(profile_is_public: boolean) {
  return useApi()('/api/holder/profile', { method: 'PATCH', body: { profile_is_public } })
}
