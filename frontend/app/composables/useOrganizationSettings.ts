/**
 * Issuer self-service organization settings — certificate branding.
 * Matches GET/PATCH /api/organizations/me and the logo/signature upload
 * routes (backend/src/routes/organizations.js).
 *
 * Purely presentational data: none of it is read by the hash or the chain —
 * see the backend route's own header comment.
 *
 * Certificate template choice is NOT here — it's per-course, set via
 * updateCourseTemplate() in useCertificates.ts.
 */
export interface OrganizationSettings {
  id: string
  name: string
  logoUrl: string | null
  signatureUrl: string | null
  signatoryName: string | null
  signatoryTitle: string | null
}

export function useOrganizationSettings() {
  const api = useApi()
  const { data, pending, refresh, error } = useAsyncData<OrganizationSettings>(
    'issuer:organization:me',
    () => api<OrganizationSettings>('/api/organizations/me'),
  )
  return { organization: data, pending, refresh, error }
}

export interface UpdateOrganizationInput {
  signatoryName?: string
  signatoryTitle?: string
}

export function updateOrganizationSettings(body: UpdateOrganizationInput) {
  return useApi()<OrganizationSettings>('/api/organizations/me', {
    method: 'PATCH',
    body,
  })
}

export function uploadOrgLogo(file: File) {
  const body = new FormData()
  body.append('logo', file)
  return useApi()<OrganizationSettings>('/api/organizations/me/logo', {
    method: 'POST',
    body,
  })
}

export function removeOrgLogo() {
  return useApi()<OrganizationSettings>('/api/organizations/me/logo', {
    method: 'DELETE',
  })
}

export function uploadOrgSignature(file: File) {
  const body = new FormData()
  body.append('signature', file)
  return useApi()<OrganizationSettings>('/api/organizations/me/signature', {
    method: 'POST',
    body,
  })
}

export function removeOrgSignature() {
  return useApi()<OrganizationSettings>('/api/organizations/me/signature', {
    method: 'DELETE',
  })
}
