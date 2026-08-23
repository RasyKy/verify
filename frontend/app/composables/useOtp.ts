/**
 * Email one-time codes.
 *
 * ── Why this constant exists ──
 *
 * Supabase mints the code, and its length is a PROJECT SETTING, not something
 * the client can ask for: Authentication → Sign In / Providers → Email → "Email
 * OTP Length". This project is set to 8.
 *
 * Getting it wrong is silent and total. `UPinInput` renders exactly `length`
 * boxes, so a 6-box input against an 8-digit code cannot accept a valid code at
 * all — there is nowhere to type the last two digits, and the submit guard
 * never sees a complete value. Nothing errors; the code simply never verifies.
 * That is the bug this constant was extracted to prevent recurring, so read
 * the setting before changing the number here.
 *
 * Verified against this project with `auth.admin.generateLink()`, which returns
 * the `email_otp` the email would carry — 8 digits for both `recovery` and
 * `magiclink`.
 */
export const OTP_LENGTH = 8

/** How long to disable "Resend code" after a send, in seconds. */
export const OTP_RESEND_SECONDS = 30

/**
 * Countdown driving a resend button.
 *
 * Extracted because the claim flow and the password reset both need it and
 * both had to clean the interval up on unmount — a leaked timer here keeps
 * firing against a torn-down component.
 */
export function useResendCountdown(seconds = OTP_RESEND_SECONDS) {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | undefined

  const canResend = computed(() => remaining.value <= 0)

  function start() {
    if (timer) clearInterval(timer)
    remaining.value = seconds
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) {
        clearInterval(timer)
        timer = undefined
      }
    }, 1000)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = undefined
    remaining.value = 0
  }

  onBeforeUnmount(stop)

  return { remaining, canResend, start, stop }
}
