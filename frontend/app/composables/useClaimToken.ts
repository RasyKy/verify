export interface ClaimPreview {
  valid: boolean
  expired: boolean
  used: boolean
  studentName: string
  courseName: string
  institutionName: string
  email: string
}

export function useClaimToken(token: string) {
  const { data: preview, pending, error } = useFetch<ClaimPreview>(
    `/api/claim/${token}/preview`,
    { default: () => null },
  )

  return { preview, pending, error }
}
