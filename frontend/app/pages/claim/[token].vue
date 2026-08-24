<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const token = route.params.token as string

const supabase = useSupabaseClient()
const supaUser = useSupabaseUser()

const { preview, pending, error } = useClaimToken(token)

// ---- Claim lifecycle ----
const claiming = ref(false)
const claimed = ref(false)
const claimError = ref('')
let redirectTimer: ReturnType<typeof setTimeout> | null = null

// Order matters. `valid` is defined server-side as `!used && !expired`, so
// testing `!valid` before the specific cases would swallow both of them and
// every dead link — used, superseded, expired — would read "invalid", which is
// the one message that tells the holder nothing about what to do next.
//
// A failed request is not a verdict on the link either. The preview is rate
// limited, and reading a 429 (or a backend that is simply down) as "invalid"
// tells someone holding a perfectly good link to go contact their institution
// when all they need to do is wait. An unknown token is different: it answers
// 200 with a blank preview, and falls through to the final `!valid`.
const viewState = computed(() => {
  if (claimed.value) return 'success'
  if (pending.value) return 'loading'
  if (error.value) {
    // useAsyncData wraps ofetch's FetchError, and which of these carries the
    // status has moved between versions, so read both rather than pin one.
    const err = error.value as {
      statusCode?: number
      status?: number
      data?: { error?: { code?: string } }
    }
    const status = err.statusCode ?? err.status
    const rateLimited = status === 429 || err.data?.error?.code === 'RATE_LIMITED'
    return rateLimited ? 'rateLimited' : 'unavailable'
  }
  if (!preview.value) return 'unavailable'
  if (preview.value.superseded) return 'superseded'
  if (preview.value.used) return 'used'
  if (preview.value.expired) return 'expired'
  if (!preview.value.valid) return 'invalid'
  return 'form'
})

async function finalizeClaim() {
  if (claiming.value || claimed.value) return
  claiming.value = true
  claimError.value = ''
  try {
    // Every path into this function must be claiming AS the recipient, and
    // useApi() sends whichever session the browser happens to hold. An
    // unrelated one is easy to be carrying — an issuer testing their own
    // claim link is the obvious case — and the backend then answers "must be
    // claimed with the email it was issued to", which reads as a complaint
    // about the address on screen rather than about who is signed in. Only
    // the Google path checked this; checking here covers all three.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const signedInAs = session?.user?.email?.toLowerCase().trim()
    const expected = preview.value?.email?.toLowerCase().trim()

    if (!signedInAs) {
      claimError.value =
        'Your sign-in did not complete, so there is nothing to claim with yet. Please use the login code above.'
      return
    }
    if (signedInAs !== expected) {
      await supabase.auth.signOut()
      claimError.value = `You are signed in as ${signedInAs}, but this certificate belongs to ${expected}. You have been signed out — please continue with that address.`
      return
    }

    await confirmClaim(token)
    claimed.value = true
    redirectTimer = setTimeout(() => navigateTo('/recipient'), 1500)
  } catch (err: any) {
    claimError.value = err?.data?.message ?? 'Could not confirm your claim. Please try again.'
  } finally {
    claiming.value = false
  }
}

// ---- Method 1: Google OAuth ----
const oauthLoading = ref(false)
const oauthMismatch = ref<{ got: string; expected: string } | null>(null)
const oauthFlagKey = `claim-oauth-pending:${token}`
let oauthHandled = false

async function onGoogleClick() {
  oauthMismatch.value = null
  oauthLoading.value = true
  sessionStorage.setItem(oauthFlagKey, '1')
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/claim/${token}` },
  })
}

// signInWithOAuth redirects the whole tab away and back, so the "did our OAuth
// attempt just come back" state has to be persisted (sessionStorage), not held
// in a ref — and it must be scoped to this token so an unrelated pre-existing
// session (e.g. already logged in elsewhere) can never be mistaken for one.
watch(supaUser, async (user) => {
  if (import.meta.server) return
  if (!user || oauthHandled) return
  const armed = sessionStorage.getItem(oauthFlagKey)
  if (!armed) return
  sessionStorage.removeItem(oauthFlagKey)
  oauthHandled = true

  const got = user.email?.toLowerCase().trim()
  const expected = preview.value?.email?.toLowerCase().trim()
  if (!got || got !== expected) {
    await supabase.auth.signOut()
    oauthMismatch.value = { got: got ?? '(unknown)', expected: expected ?? '' }
    oauthHandled = false // allow a genuine retry with the correct account
    return
  }
  await finalizeClaim()
}, { immediate: true })

// ---- Method 2: Email OTP ----
const otpStep = ref<'idle' | 'sent'>('idle')
const otpCode = ref<(string | number)[]>([])
const otpCodeValue = computed(() => otpCode.value.join(''))
const otpSending = ref(false)
const otpVerifying = ref(false)
const otpError = ref('')
const {
  remaining: resendSeconds,
  canResend,
  start: startResendCountdown,
} = useResendCountdown()

async function sendOtp() {
  const p = preview.value
  if (!p) return
  otpSending.value = true
  otpError.value = ''
  try {
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: p.email,
      options: { shouldCreateUser: true },
    })
    if (sendError) {
      otpError.value = authErrorMessage(sendError, 'Could not send your login code.')
      return
    }
    otpStep.value = 'sent'
    otpCode.value = []
    startResendCountdown()
  } finally {
    otpSending.value = false
  }
}

async function verifyCode(code: string) {
  const p = preview.value
  if (otpVerifying.value || code.length !== OTP_LENGTH || !p) return
  otpVerifying.value = true
  otpError.value = ''
  try {
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: p.email,
      token: code,
      type: 'email',
    })
    if (verifyError || !data.session) {
      otpError.value = 'Incorrect or expired code. Please try again or resend.'
      otpCode.value = []
      return
    }
    await finalizeClaim()
  } finally {
    otpVerifying.value = false
  }
}

// ---- Method 3: Password ----
// null = still checking, true = existing holder signing in, false = first-time claim
const accountExists = ref<boolean | null>(null)
const password = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSubmitting = ref(false)

watch(viewState, async (state) => {
  const p = preview.value
  if (state !== 'form' || accountExists.value !== null || !p) return
  try {
    const res = await checkAccountExists(p.email)
    accountExists.value = res.exists
  } catch {
    accountExists.value = false
  }
}, { immediate: true })

async function onCreateAccount() {
  const p = preview.value
  if (!p) return
  passwordError.value = ''
  if (password.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.'
    return
  }
  passwordSubmitting.value = true
  try {
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: p.email,
      password: password.value,
    })
    if (signUpError) {
      passwordError.value = authErrorMessage(signUpError, 'Could not create your account.')
      return
    }
    // No error and no session means the sign-up did not sign anyone in, and
    // Supabase deliberately does not say which of the two reasons applies: it
    // will not confirm to an anonymous caller that an address is already
    // registered, so a taken email is returned looking exactly like a fresh
    // sign-up awaiting email confirmation. Proceeding to claim on that would
    // send whatever stale session the browser holds. The login code resolves
    // either case, so point there rather than guess.
    if (!data.session) {
      passwordError.value =
        'Could not sign you in with that password — this address may already have an account. Use the login code above instead; it works either way.'
      return
    }
    await finalizeClaim()
  } finally {
    passwordSubmitting.value = false
  }
}

async function onSignIn() {
  const p = preview.value
  if (!p) return
  passwordError.value = ''
  passwordSubmitting.value = true
  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: p.email,
      password: password.value,
    })
    if (signInError) {
      passwordError.value = 'Incorrect password'
      password.value = ''
      return
    }
    await finalizeClaim()
  } finally {
    passwordSubmitting.value = false
  }
}

/*
 * Hand off to the code-based reset rather than sending the mail from here.
 *
 * The previous version called `resetPasswordForEmail(p.email)` with no
 * `redirectTo`, so Supabase fell back to the project's Site URL — which is how
 * a production reset ended up pointing at localhost. It also had nowhere to
 * type the code the recovery template actually sends (see
 * backend/scripts/set-auth-email-templates.js), so it dead-ended either way.
 * /auth/forgot-password prefills from `?email=` and owns the whole flow.
 */
function onForgotPassword() {
  const p = preview.value
  if (!p) return
  return navigateTo(`/auth/forgot-password?email=${encodeURIComponent(p.email)}`)
}

// useResendCountdown() clears its own interval on unmount.
onUnmounted(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<template>
  <div class="min-h-screen page-ground flex items-center justify-center px-4">
    <div class="max-w-sm w-full surface-panel p-8">
      <!-- Loading -->
      <div v-if="viewState === 'loading'" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-300 animate-spin" />
      </div>

      <!-- Invalid -->
      <div v-else-if="viewState === 'invalid'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-question-mark-circle" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">This claim link is invalid.</h1>
        <p class="text-sm text-gray-500 mt-2">Please check the email again or contact your institution.</p>
      </div>

      <!-- Rate limited — the link is fine, the API is refusing to answer -->
      <div v-else-if="viewState === 'rateLimited'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-clock" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">Too many attempts.</h1>
        <p class="text-sm text-gray-500 mt-2">
          Your link is still valid — please wait a few minutes and reload this page.
        </p>
      </div>

      <!-- Request failed for some other reason -->
      <div v-else-if="viewState === 'unavailable'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">We could not check this link.</h1>
        <p class="text-sm text-gray-500 mt-2">
          Something went wrong on our side, not with your link. Please reload the page, or try
          again shortly.
        </p>
      </div>

      <!-- Superseded — a newer claim email retired this link -->
      <div v-else-if="viewState === 'superseded'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">This link has been replaced.</h1>
        <p class="text-sm text-gray-500 mt-2">
          A newer claim email was sent to you — please open the most recent one. Your certificate
          has not been claimed yet.
        </p>
      </div>

      <!-- Used -->
      <div v-else-if="viewState === 'used'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-lock-closed" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">This certificate has already been claimed.</h1>
        <p class="text-sm text-gray-500 mt-2">If this wasn't you, contact your institution.</p>
      </div>

      <!-- Expired -->
      <div v-else-if="viewState === 'expired'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-clock" class="w-6 h-6 text-gray-400" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">This claim link has expired.</h1>
        <p class="text-sm text-gray-500 mt-2">
          Claim links are valid for 7 days. Please contact your institution to request a new one.
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="viewState === 'success'" class="text-center py-4">
        <div class="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-600" />
        </div>
        <h1 class="text-lg font-medium text-gray-900">Certificate claimed!</h1>
        <p class="text-sm text-gray-500 mt-2">Redirecting to your dashboard...</p>
      </div>

      <!-- Valid token: claim form -->
      <div v-else>
        <BrandLogo :size="40" center class="mb-5" />

        <h1 class="text-lg font-medium text-gray-900 text-center">Claim your certificate</h1>
        <p class="text-sm text-gray-500 text-center mt-1">
          {{ preview!.courseName }} — {{ preview!.institutionName }}
        </p>

        <div class="mt-5 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-center">
          <p class="text-sm text-gray-700">{{ preview!.email }}</p>
        </div>
        <p class="text-xs text-gray-400 text-center mt-1.5">This certificate was issued to this email</p>

        <!-- Method 1: Google OAuth -->
        <div class="mt-6">
          <UButton
            variant="outline"
            :loading="oauthLoading"
            class="w-full justify-center gap-2 bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            @click="onGoogleClick"
          >
            <template #leading>
              <svg class="w-4 h-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C40.945 35.826 44 30.5 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
            </template>
            Continue with Google
          </UButton>

          <UAlert
            v-if="oauthMismatch"
            color="error"
            variant="subtle"
            class="mt-3"
            :title="`Your Google account (${oauthMismatch.got}) doesn't match the certificate's email (${oauthMismatch.expected}). Please use password or a login code instead, or sign in with the correct Google account.`"
          />
        </div>

        <div class="flex items-center gap-3 my-5">
          <div class="flex-1 h-px bg-gray-200" />
          <span class="text-xs text-gray-400 shrink-0">or</span>
          <div class="flex-1 h-px bg-gray-200" />
        </div>

        <!-- Method 2: Email OTP -->
        <div>
          <UButton
            v-if="otpStep === 'idle'"
            variant="ghost"
            :loading="otpSending"
            class="w-full justify-center"
            @click="sendOtp"
          >
            Send a login code to {{ preview!.email }}
          </UButton>

          <div v-else class="space-y-3">
            <label class="block text-sm font-medium text-gray-700 text-center">
              Enter the code sent to your email
            </label>
            <UPinInput
              v-model="otpCode"
              :length="OTP_LENGTH"
              type="number"
              otp
              size="xl"
              class="justify-center"
              :disabled="otpVerifying"
              @complete="(value) => verifyCode(value.join(''))"
            />
            <UButton
              class="w-full justify-center"
              :loading="otpVerifying"
              :disabled="otpCodeValue.length !== OTP_LENGTH"
              @click="verifyCode(otpCodeValue)"
            >
              Verify code
            </UButton>
            <p class="text-center text-xs">
              <button
                type="button"
                class="text-teal-600 hover:underline disabled:text-gray-300 disabled:hover:no-underline disabled:cursor-not-allowed"
                :disabled="!canResend"
                @click="sendOtp"
              >
                Resend code{{ canResend ? '' : ` (${resendSeconds}s)` }}
              </button>
            </p>
          </div>

          <!-- Rendered regardless of otpStep — a failed *initial* send never
               flips otpStep to 'sent', so the alert can't live inside that branch -->
          <UAlert v-if="otpError" color="error" variant="subtle" class="mt-3" :title="otpError" />
        </div>

        <div class="flex items-center gap-3 my-5">
          <div class="flex-1 h-px bg-gray-200" />
          <span class="text-xs text-gray-400 shrink-0">or</span>
          <div class="flex-1 h-px bg-gray-200" />
        </div>

        <!-- Method 3: Password -->
        <div>
          <div v-if="accountExists === null" class="h-9 rounded-md bg-gray-100 animate-pulse" />

          <form v-else-if="accountExists === false" class="space-y-3" @submit.prevent="onCreateAccount">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="new-password">Set a password</label>
              <UInput
                id="new-password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                autocomplete="new-password"
                class="w-full bg-white"
                :disabled="passwordSubmitting"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="confirm-password">Confirm password</label>
              <UInput
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                placeholder="••••••••"
                autocomplete="new-password"
                class="w-full bg-white"
                :disabled="passwordSubmitting"
              />
            </div>
            <UAlert v-if="passwordError" color="error" variant="subtle" :title="passwordError" />
            <UButton type="submit" color="primary" class="w-full justify-center" :loading="passwordSubmitting">
              Create account and claim
            </UButton>
          </form>

          <form v-else class="space-y-3" @submit.prevent="onSignIn">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="existing-password">Enter your password</label>
              <UInput
                id="existing-password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                autocomplete="current-password"
                class="w-full bg-white"
                :disabled="passwordSubmitting"
              />
            </div>
            <UAlert v-if="passwordError" color="error" variant="subtle" :title="passwordError" />
            <UButton type="submit" color="primary" class="w-full justify-center" :loading="passwordSubmitting">
              Sign in and claim
            </UButton>
            <p class="text-center text-xs">
              <button
                type="button"
                class="text-teal-600 hover:underline"
                @click="onForgotPassword"
              >
                Forgot password?
              </button>
            </p>
          </form>
        </div>

        <UAlert v-if="claimError" color="error" variant="subtle" class="mt-5" :title="claimError" />
      </div>
    </div>
  </div>
</template>
