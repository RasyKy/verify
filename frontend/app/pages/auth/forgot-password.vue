<script setup lang="ts">
/**
 * Password reset, by code rather than by link.
 *
 * ── Why not the emailed link ──
 *
 * `resetPasswordForEmail` still sends the mail, but the link in it is no longer
 * what this flow depends on, because a link-only reset has three failure modes
 * that no amount of frontend care can fix:
 *
 *   1. Flow mismatch. @nuxtjs/supabase defaults `useSsrCookies: true`, which
 *      builds the client through @supabase/ssr's `createBrowserClient` — and
 *      that hardcodes `flowType: 'pkce'`. A recovery redirect that arrives as
 *      an implicit-grant URL (`#access_token=…`) is then rejected outright by
 *      auth-js with "Not a valid PKCE flow url", so no session is created and
 *      the landing page can only report that the link is dead.
 *   2. Wrong device. A PKCE link is only redeemable in the browser that asked
 *      for the reset, because the code verifier lives in that browser's
 *      storage. Requesting on a laptop and opening the mail on a phone — the
 *      single most common thing people do — cannot work by construction.
 *   3. Link scanners. Corporate mail filters and webmail previews fetch links
 *      before a human clicks them, and a one-time recovery token is spent on
 *      first fetch. The user then clicks an already-burned link.
 *
 * A typed code has none of those properties: it is device-independent, survives
 * being fetched by a scanner, and never touches the redirect allowlist. It is
 * also the mechanism the claim flow already uses, so there is one story here
 * rather than two.
 *
 * ── What this needs on the Supabase side ──
 *
 * The "Reset Password" email template must render `{{ .Token }}`. The stock
 * template only contains `{{ .ConfirmationURL }}`, and with that template the
 * mail carries no code to type.
 *
 * The mail itself is sent by Supabase Auth, NOT by services/email.js — that
 * module only handles claim and expiry notices. Routing these through Resend is
 * a Custom SMTP setting in the Supabase dashboard, not a code change here.
 */
definePageMeta({ layout: false })

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const supabase = useSupabaseClient()

type Step = 'email' | 'code' | 'password' | 'done'
const step = ref<Step>('email')

const email = ref('')
const code = ref<(string | number)[]>([])
const codeValue = computed(() => code.value.join(''))
const password = ref('')
const confirm = ref('')

const busy = ref(false)
const errorMessage = ref('')

const { remaining: resendSeconds, canResend, start: startResend } = useResendCountdown()

/** Prefill from ?email= so the claim page can hand someone straight over. */
const route = useRoute()
onMounted(() => {
  const q = route.query.email
  if (typeof q === 'string') email.value = q
})

async function sendCode() {
  const address = email.value.trim()
  if (!address || busy.value) return

  busy.value = true
  errorMessage.value = ''
  try {
    /*
     * `redirectTo` is still supplied so the link in the same email keeps
     * working for anyone who opens it in the browser that asked — it is a
     * bonus path, not the one this page depends on.
     */
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    })
    /*
     * Rate limits and transport failures are worth showing. "No such account"
     * is not, and Supabase does not report it either — confirming which
     * addresses have accounts would turn this form into a way to enumerate
     * them. So a nonexistent address advances to the code step exactly like a
     * real one, and simply never receives a code that works.
     */
    if (error) {
      errorMessage.value = error.message
      return
    }
    step.value = 'code'
    code.value = []
    startResend()
  } finally {
    busy.value = false
  }
}

async function verifyCode() {
  if (busy.value || codeValue.value.length !== OTP_LENGTH) return

  busy.value = true
  errorMessage.value = ''
  try {
    // `type: 'recovery'` — NOT 'email'. The recovery code is minted by
    // resetPasswordForEmail and will not verify against the magic-link type.
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.value.trim(),
      token: codeValue.value,
      type: 'recovery',
    })
    if (error || !data.session) {
      errorMessage.value = 'That code is incorrect or has expired. Request a new one.'
      code.value = []
      return
    }
    // The code bought a real session; the account is now free to set a password.
    step.value = 'password'
  } finally {
    busy.value = false
  }
}

const passwordProblem = computed(() => {
  if (!password.value) return null
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  if (confirm.value && password.value !== confirm.value) return 'Passwords do not match'
  return null
})

const canSavePassword = computed(
  () => password.value.length >= 8 && password.value === confirm.value && !busy.value,
)

async function savePassword() {
  if (!canSavePassword.value) return

  busy.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) {
      errorMessage.value = error.message
      return
    }
    // Verifying the code signed them in, so send them to their own portal
    // rather than back to a login form they no longer need.
    clearMe()
    const me = await fetchMe()
    step.value = 'done'
    await navigateTo(me ? (ROLE_HOME[me.role] ?? '/') : '/login')
  } finally {
    busy.value = false
  }
}

function backToEmail() {
  step.value = 'email'
  code.value = []
  errorMessage.value = ''
}
</script>

<template>
  <div class="shell">
    <main class="panel">
      <NuxtLink to="/login" class="back-link">
        <UIcon name="i-heroicons-arrow-left" class="size-4" />
        Back to sign in
      </NuxtLink>

      <div class="card">
        <BrandLogo :size="44" center class="card-mark" />

        <!-- ── Step 1: who are you ── -->
        <template v-if="step === 'email'">
          <h1 class="headline">Reset your password</h1>
          <p class="sub">
            Enter the email you sign in with and we'll send you a code to set a
            new one.
          </p>

          <form class="form" @submit.prevent="sendCode">
            <div class="field">
              <label class="label" for="fp-email">Email</label>
              <UInput
                id="fp-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                icon="i-heroicons-envelope"
                size="lg"
                class="w-full"
                :disabled="busy"
              />
            </div>

            <UAlert
              v-if="errorMessage"
              color="error"
              variant="subtle"
              icon="i-heroicons-exclamation-triangle"
              :title="errorMessage"
            />

            <button type="submit" class="submit" :disabled="busy || !email.trim()">
              <UIcon v-if="busy" name="i-heroicons-arrow-path" class="size-4 spin" />
              {{ busy ? 'Sending…' : 'Send code' }}
            </button>
          </form>
        </template>

        <!-- ── Step 2: the code ── -->
        <template v-else-if="step === 'code'">
          <div class="step-icon">
            <UIcon name="i-heroicons-envelope-open" class="size-6" />
          </div>
          <h1 class="headline">Enter your code</h1>
          <p class="sub">
            If <strong>{{ email.trim() }}</strong> has an account, the
            {{ OTP_LENGTH }}-digit code is on its way. It expires in one hour.
          </p>

          <div class="code-row">
            <UPinInput
              v-model="code"
              :length="OTP_LENGTH"
              otp
              size="md"
              :disabled="busy"
              @complete="verifyCode"
            />
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :title="errorMessage"
            class="mt-4 text-left"
          />

          <button
            type="button"
            class="submit mt-5"
            :disabled="busy || codeValue.length !== OTP_LENGTH"
            @click="verifyCode"
          >
            <UIcon v-if="busy" name="i-heroicons-arrow-path" class="size-4 spin" />
            {{ busy ? 'Checking…' : 'Verify code' }}
          </button>

          <div class="foot-actions">
            <button
              type="button"
              class="ghost"
              :disabled="!canResend || busy"
              @click="sendCode"
            >
              {{ canResend ? 'Resend code' : `Resend in ${resendSeconds}s` }}
            </button>
            <span class="dot" aria-hidden="true">·</span>
            <button type="button" class="ghost" @click="backToEmail">
              Use a different email
            </button>
          </div>
        </template>

        <!-- ── Step 3: the new password ── -->
        <template v-else-if="step === 'password'">
          <div class="step-icon step-icon--ok">
            <UIcon name="i-heroicons-check" class="size-6" />
          </div>
          <h1 class="headline">Choose a new password</h1>
          <p class="sub">Signed in as {{ email.trim() }}</p>

          <form class="form" @submit.prevent="savePassword">
            <div class="field">
              <label class="label" for="fp-password">New password</label>
              <UInput
                id="fp-password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                placeholder="At least 8 characters"
                size="lg"
                class="w-full"
                :disabled="busy"
              />
            </div>

            <div class="field">
              <label class="label" for="fp-confirm">Confirm password</label>
              <UInput
                id="fp-confirm"
                v-model="confirm"
                type="password"
                autocomplete="new-password"
                size="lg"
                class="w-full"
                :disabled="busy"
              />
            </div>

            <p v-if="passwordProblem" class="problem">{{ passwordProblem }}</p>

            <UAlert
              v-if="errorMessage"
              color="error"
              variant="subtle"
              icon="i-heroicons-exclamation-triangle"
              :title="errorMessage"
            />

            <button type="submit" class="submit" :disabled="!canSavePassword">
              <UIcon v-if="busy" name="i-heroicons-arrow-path" class="size-4 spin" />
              {{ busy ? 'Saving…' : 'Save password and continue' }}
            </button>
          </form>
        </template>

        <template v-else>
          <p class="sub py-6">Taking you to your portal…</p>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  background: var(--canvas-app);
  display: flex;
}

.panel {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.back-link {
  position: absolute;
  top: 28px;
  left: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast), border-color var(--transition-fast),
              transform var(--transition-fast);
}

.back-link:hover {
  color: var(--accent-text);
  border-color: var(--accent);
  transform: translateX(-2px);
}

.back-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.card {
  width: 100%;
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
  padding: 36px 34px 30px;
  text-align: center;
}

/* Centering is the component's own `center` prop — see BrandLogo.vue. */
.card-mark {
  margin-bottom: 20px;
}

.step-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-icon--ok {
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
}

.headline {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin: 0;
}

.sub {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 8px 0 0;
}

.form {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

/* The pin boxes are the widest thing in the card; let them scroll rather than
   burst the panel on a narrow phone. */
.code-row {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding-bottom: 4px;
}

.problem {
  font-size: 12.5px;
  color: var(--status-expired-text);
  margin: -4px 0 0;
}

.submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 18px;
  border: none;
  border-radius: 10px;
  background: var(--grad-brand);
  box-shadow: var(--shadow-tile);
  color: #fff;
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.submit:hover:not(:disabled) { transform: translateY(-1px); }
.submit:disabled { opacity: 0.6; cursor: not-allowed; }
.submit:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.foot-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}

.ghost {
  background: none;
  border: none;
  color: var(--accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ghost:disabled {
  color: var(--text-tertiary);
  cursor: default;
  text-decoration: none;
}

.dot { color: var(--text-tertiary); }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .back-link:hover, .submit:hover:not(:disabled) { transform: none; }
  .spin { animation: none; }
}

@media (max-width: 620px) {
  .panel { padding-top: 84px; }
  .back-link { top: 20px; left: 20px; }
  .card { padding: 32px 22px 26px; }
}
</style>
