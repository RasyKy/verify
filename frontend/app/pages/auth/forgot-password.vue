<script setup lang="ts">
/**
 * Password reset — request an emailed link.
 *
 * The link lands on /auth/set-password, which turns the recovery session it
 * carries into a chosen password. One caveat is structural rather than a bug:
 * @nuxtjs/supabase defaults `useSsrCookies: true`, so the client is built by
 * @supabase/ssr's `createBrowserClient`, which hardcodes `flowType: 'pkce'`.
 * The code verifier lives in the storage of the browser that asked, so the link
 * only redeems there — hence the copy telling people to open it on this device,
 * and the recoverable state set-password.vue shows when it does not.
 *
 * The mail is sent by Supabase Auth, NOT by services/email.js — that module
 * only handles claim and expiry notices. Routing it through Resend is a Custom
 * SMTP setting in the Supabase dashboard, not a code change here.
 */
definePageMeta({ layout: false })

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const supabase = useSupabaseClient()

const step = ref<'email' | 'sent'>('email')
const email = ref('')

const busy = ref(false)
const errorMessage = ref('')

const { remaining: resendSeconds, canResend, start: startResend } = useResendCountdown()

/** Prefill from ?email= so the claim page can hand someone straight over. */
const route = useRoute()
onMounted(() => {
  const q = route.query.email
  if (typeof q === 'string') email.value = q
})

async function sendResetLink() {
  const address = email.value.trim()
  if (!address || busy.value) return

  busy.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    })
    /*
     * Rate limits and transport failures are worth showing. "No such account"
     * is not, and Supabase does not report it either — confirming which
     * addresses have accounts would turn this form into a way to enumerate
     * them. So a nonexistent address advances to the sent step exactly like a
     * real one, and simply never receives mail.
     */
    if (error) {
      errorMessage.value = error.message
      return
    }
    step.value = 'sent'
    startResend()
  } finally {
    busy.value = false
  }
}

function backToEmail() {
  step.value = 'email'
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
            Enter the email you sign in with and we'll send you a link to set a
            new one.
          </p>

          <form class="form" @submit.prevent="sendResetLink">
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
              {{ busy ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        </template>

        <!-- ── Step 2: it's in their inbox ── -->
        <template v-else>
          <div class="step-icon">
            <UIcon name="i-heroicons-envelope-open" class="size-6" />
          </div>
          <h1 class="headline">Check your inbox</h1>
          <p class="sub">
            If <strong>{{ email.trim() }}</strong> has an account, a link to set
            a new password is on its way. It expires in one hour.
          </p>
          <p class="sub note">
            Open it in this browser — for security the link only works on the
            device that asked for it.
          </p>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            :title="errorMessage"
            class="mt-4 text-left"
          />

          <div class="foot-actions">
            <button
              type="button"
              class="ghost"
              :disabled="!canResend || busy"
              @click="sendResetLink"
            >
              {{ canResend ? 'Resend email' : `Resend in ${resendSeconds}s` }}
            </button>
            <span class="dot" aria-hidden="true">·</span>
            <button type="button" class="ghost" @click="backToEmail">
              Use a different email
            </button>
          </div>
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

.note {
  font-size: 12.5px;
  color: var(--text-tertiary);
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
