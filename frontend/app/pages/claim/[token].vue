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

const viewState = computed(() => {
  if (claimed.value) return 'success'
  if (pending.value) return 'loading'
  if (error.value || !preview.value?.valid) return 'invalid'
  if (preview.value.used) return 'used'
  if (preview.value.expired) return 'expired'
  return 'form'
})

async function finalizeClaim() {
  if (claiming.value || claimed.value) return
  claiming.value = true
  claimError.value = ''
  try {
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
const resendSeconds = ref(0)
let resendTimer: ReturnType<typeof setInterval> | null = null

const canResend = computed(() => resendSeconds.value <= 0)

function startResendCountdown(seconds = 30) {
  if (resendTimer) clearInterval(resendTimer)
  resendSeconds.value = seconds
  resendTimer = setInterval(() => {
    resendSeconds.value -= 1
    if (resendSeconds.value <= 0 && resendTimer) {
      clearInterval(resendTimer)
      resendTimer = null
    }
  }, 1000)
}

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
      otpError.value = sendError.message
      return
    }
    otpStep.value = 'sent'
    otpCode.value = []
    startResendCountdown(30)
  } finally {
    otpSending.value = false
  }
}

async function verifyCode(code: string) {
  const p = preview.value
  if (otpVerifying.value || code.length !== 6 || !p) return
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
const forgotPasswordSending = ref(false)
const forgotPasswordSent = ref(false)

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
    const { error: signUpError } = await supabase.auth.signUp({
      email: p.email,
      password: password.value,
    })
    if (signUpError) {
      passwordError.value = signUpError.message
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

async function onForgotPassword() {
  const p = preview.value
  if (!p || forgotPasswordSending.value) return
  forgotPasswordSending.value = true
  try {
    await supabase.auth.resetPasswordForEmail(p.email)
    forgotPasswordSent.value = true
  } finally {
    forgotPasswordSending.value = false
  }
}

onUnmounted(() => {
  if (resendTimer) clearInterval(resendTimer)
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="max-w-sm w-full bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
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
        <div class="flex justify-center mb-5">
          <div class="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-base leading-none">V</span>
          </div>
        </div>

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
              :length="6"
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
              :disabled="otpCodeValue.length !== 6"
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
              <span v-if="forgotPasswordSent" class="text-gray-400">Password reset email sent.</span>
              <button
                v-else
                type="button"
                class="text-teal-600 hover:underline disabled:text-gray-300"
                :disabled="forgotPasswordSending"
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
