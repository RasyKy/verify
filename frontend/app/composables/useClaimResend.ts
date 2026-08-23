import { apiErrorMessage, type ResendClaimResult } from './useCertificates'

/**
 * Shared handling for "send the claim link again", used by both the issuer and
 * the admin certificate tables.
 *
 * The interesting case is the unhappy one. A claim token exists in exactly one
 * place — the email carrying it — so when the provider refuses that email the
 * certificate becomes unclaimable with nothing to recover. Outside production
 * the endpoint hands the live URL back for precisely this reason, so put it on
 * the clipboard rather than making someone dig it out of a server log.
 *
 * @param send the API call to use — the issuer and admin variants hit the same
 *             endpoint, they just differ in how the request is scoped.
 */
export function useClaimResend(
  send: (id: string) => Promise<ResendClaimResult>,
) {
  const toast = useToast()
  /** The row currently in flight, so a table can disable just that button. */
  const resendingId = ref<string | null>(null)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Denied permission, or a non-secure context. The URL still goes in the
      // toast body, so nothing is lost but the convenience.
      return false
    }
  }

  async function resendClaim(id: string) {
    if (resendingId.value) return
    resendingId.value = id
    try {
      const result = await send(id)

      if (result.claim_email_sent) {
        toast.add({
          title: 'Claim email sent',
          description: `A new link is on its way to ${result.sent_to}. The previous one no longer works.`,
          color: 'success',
        })
        return
      }

      if (!result.claim_url) {
        toast.add({
          title: 'Link renewed, but the email was refused',
          description: `The mail provider would not deliver to ${result.sent_to}. Check the sending domain.`,
          color: 'warning',
        })
        return
      }

      const copied = await copy(result.claim_url)
      toast.add({
        title: 'Link renewed, but the email was refused',
        description: copied
          ? `The mail provider would not deliver to ${result.sent_to}. The claim link is on your clipboard.`
          : `The mail provider would not deliver to ${result.sent_to}. Claim link: ${result.claim_url}`,
        color: 'warning',
      })
    } catch (err) {
      toast.add({
        title: 'Could not renew the claim link',
        description: apiErrorMessage(
          err,
          'Nothing changed — the existing link still works.',
        ),
        color: 'error',
      })
    } finally {
      resendingId.value = null
    }
  }

  return { resendClaim, resendingId }
}
