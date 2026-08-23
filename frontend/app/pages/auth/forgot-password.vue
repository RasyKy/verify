<script setup lang="ts">
/**
 * Requests a password-reset email.
 *
 * Supabase mints the link and drops a short-lived recovery session when it is
 * opened; auth/set-password.vue already turns exactly that into a chosen
 * password, so this page only has to start the flow.
 *
 * The mail itself is sent by Supabase Auth, NOT by services/email.js — that
 * module only handles claim and expiry notices. Routing these through Resend is
 * a Custom SMTP setting in the Supabase dashboard, not a code change here.
 */
definePageMeta({ layout: false })

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const supabase = useSupabaseClient()

const email = ref('')
const sending = ref(false)
const sent = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  const address = email.value.trim()
  if (!address || sending.value) return

  sending.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    })
    // A rate-limit or transport failure is worth showing; "no such account" is
    // not, and Supabase does not report it either — see the note below.
    if (error) {
      errorMessage.value = error.message
      return
    }
    sent.value = true
  } finally {
    sending.value = false
  }
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
        <BrandLogo :size="44" class="card-mark" />

        <template v-if="!sent">
          <h1 class="headline">Reset your password</h1>
          <p class="sub">
            Enter the email you sign in with and we'll send a link to choose a
            new password.
          </p>

          <form class="form" @submit.prevent="onSubmit">
            <div class="field">
              <label class="label" for="fp-email">Email</label>
              <UInput
                id="fp-email"
                v-model="email"
                type="email"
                placeholder="you@institution.edu"
                autocomplete="email"
                icon="i-heroicons-envelope"
                size="lg"
                class="w-full"
                :disabled="sending"
              />
            </div>

            <UAlert
              v-if="errorMessage"
              color="error"
              variant="subtle"
              icon="i-heroicons-exclamation-triangle"
              :title="errorMessage"
            />

            <button type="submit" class="submit" :disabled="sending || !email.trim()">
              <UIcon v-if="sending" name="i-heroicons-arrow-path" class="size-4 spin" />
              {{ sending ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        </template>

        <template v-else>
          <div class="done-icon">
            <UIcon name="i-heroicons-envelope-open" class="size-6" />
          </div>
          <h1 class="headline">Check your email</h1>
          <!--
            Deliberately does not say whether an account exists: confirming that
            turns this form into a way to enumerate who has one.
          -->
          <p class="sub">
            If <strong>{{ email.trim() }}</strong> has an account, a reset link
            is on its way. It expires in one hour and can be used once.
          </p>
          <button type="button" class="ghost" @click="sent = false">
            Use a different email
          </button>
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
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
  padding: 36px 34px 30px;
  text-align: center;
}

.card-mark {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.done-icon {
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

.ghost {
  margin-top: 20px;
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

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .back-link:hover, .submit:hover:not(:disabled) { transform: none; }
  .spin { animation: none; }
}

@media (max-width: 620px) {
  .panel { padding-top: 84px; }
  .back-link { top: 20px; left: 20px; }
}
</style>
