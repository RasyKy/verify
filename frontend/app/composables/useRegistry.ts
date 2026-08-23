/**
 * Public accredited-institution registry.
 *
 * Matches GET /api/registry — unauthenticated by design (useApi.ts's own doc
 * comment already calls this endpoint out), so this uses plain `useFetch`
 * against `apiBase` rather than `useApi()`, same as the verify page.
 */
export interface RegistryInstitution {
  /** Path under /public or an absolute URL. Null when the org has none. */
  logoUrl: string | null
  id: string
  name: string
  type: string
  joinedAt: string
}

export function useRegistry() {
  const { public: { apiBase } } = useRuntimeConfig()
  const { data: institutions, pending, error } = useFetch<RegistryInstitution[]>(
    '/api/registry',
    { baseURL: apiBase, default: () => [] },
  )
  return { institutions, pending, error }
}
