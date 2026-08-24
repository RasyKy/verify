<script setup lang="ts">
import type { Role } from '~/composables/useMe'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const supaUser = useSupabaseUser()
const route = useRoute()

// Remembers which guarded portal sent the visitor here, so the heading names it
// and sign-in can return them there. Allowlisted rather than trusting the raw
// query value, to avoid an open-redirect via an arbitrary `?redirect=`.
const PORTAL_COPY: Record<string, string> = {
  '/recipient': 'Certificate holder portal',
  '/issuer': 'Institution issuer portal',
  '/admin': 'Platform admin portal',
}
const requestedRedirect = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r in PORTAL_COPY ? r : null
})
/*
 * With no `?redirect=`, this form serves all three roles at once — holders who
 * claimed a certificate, issuers, and admins all sign in here and are routed by
 * role afterwards. Naming one of them in the subheading (it used to say
 * "Institution issuer portal" unconditionally) told the other two they were in
 * the wrong place.
 */
const portalLabel = computed(
  () => PORTAL_COPY[requestedRedirect.value] ?? 'Holders, issuers and administrators',
)

/**
 * Where to land after a successful sign-in.
 *
 * The `?redirect=` only says which portal the visitor was *trying* to reach —
 * it is not evidence they may enter it. GET /api/auth/me returns the role from
 * the `profiles` table, so honour the request only when the role actually
 * permits it, and otherwise send them to their own portal. Without this, a
 * holder signing in from /admin would land on /admin and immediately be bounced
 * by the route guard.
 */
const ROLE_PORTALS: Record<Role, string[]> = {
  admin: ['/admin'],
  issuer: ['/issuer'],
  holder: ['/recipient'],
}

async function destinationAfterLogin(): Promise<string | null> {
  const result = await resolveMe()

  if (result.state === 'unreachable') {
    // Credentials were correct and the Supabase session exists — the API is
    // simply not answering. Say that, instead of navigating into a portal that
    // will bounce straight back here.
    apiError.value = result.message
    return null
  }
  /*
   * The password was right and Supabase issued a session — it has no idea the
   * account is switched off, only `profiles.status` does. Sending them onward
   * would land on a portal that bounces straight back here with nothing said,
   * so end the session and stay put with the reason on screen.
   */
  if (result.state === 'refused') {
    await endRefusedSession(result)
    return null
  }
  if (result.state !== 'ok') return requestedRedirect.value

  const permitted = ROLE_PORTALS[result.me.role] ?? []
  return permitted.includes(requestedRedirect.value)
    ? requestedRedirect.value
    : (ROLE_HOME[result.me.role] ?? '/')
}

const email = ref('')
const password = ref('')
const error = ref(false)
/** Why a previous attempt (or a guard) rejected an otherwise valid session. */
const notice = useAuthNotice()
const loading = ref(false)
/** Set when sign-in succeeded but the backend could not be reached. */
const apiError = ref('')
const { public: { apiBase } } = useRuntimeConfig()

// Shared by password sign-in and Google OAuth: a stale profile from a
// previous session would send this one to the wrong portal, so always clear
// it before resolving where a freshly-authenticated session lands.
async function proceedAfterSignIn() {
  clearMe()
  const destination = await destinationAfterLogin()
  // null means the API is unreachable — apiError is showing why, so stay put.
  if (destination) await navigateTo(destination)
}

async function onSubmit() {
  if (!email.value || !password.value) return
  loading.value = true
  error.value = false
  notice.value = null
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (authError) {
      error.value = true
      password.value = ''
    } else {
      await proceedAfterSignIn()
    }
  } finally {
    loading.value = false
  }
}

// ---- Google OAuth ----
// Recipients who claimed their certificate via "Continue with Google" (see
// claim/[token].vue) have no password — they need the same option here.
const oauthLoading = ref(false)
const oauthFlagKey = 'login-oauth-pending'
let oauthHandled = false

async function onGoogleClick() {
  oauthLoading.value = true
  sessionStorage.setItem(oauthFlagKey, '1')
  // The full URL, not just the origin, so a `?redirect=` portal hint survives
  // the round trip to Google and back.
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  })
}

// signInWithOAuth redirects the whole tab away and back, so "did our OAuth
// attempt just come back" has to be persisted (sessionStorage), not held in a
// ref — an unrelated pre-existing session must never be mistaken for one.
watch(supaUser, async (user) => {
  if (!user || oauthHandled) return
  const armed = sessionStorage.getItem(oauthFlagKey)
  if (!armed) return
  sessionStorage.removeItem(oauthFlagKey)
  oauthHandled = true
  await proceedAfterSignIn()
}, { immediate: true })
</script>

<template>
  <div class="auth-shell">
    <!-- ── Brand panel ── -->
    <aside class="auth-brand" aria-hidden="true">
      <div class="brand-glow" />
      <div class="brand-top">
        <BrandLogo :size="40" tone="mono" wordmark />
      </div>

      <div class="brand-copy">
        <p class="brand-kicker">Blockchain certificates</p>
        <h2 class="brand-headline">
          Credentials that prove themselves.
        </h2>
        <p class="brand-sub">
          Every certificate issued here is anchored on-chain, so anyone holding
          the link can confirm it in seconds — without calling the institution
          that issued it.
        </p>
      </div>

      <ul class="brand-points">
        <li>
          <UIcon name="i-heroicons-shield-check" class="point-icon" />
          Tamper-evident by construction
        </li>
        <li>
          <UIcon name="i-heroicons-bolt" class="point-icon" />
          Instant public verification
        </li>
        <li>
          <UIcon name="i-heroicons-arrow-uturn-left" class="point-icon" />
          Revocable the moment you need it
        </li>
      </ul>
    </aside>

    <!-- ── Form panel ── -->
    <main class="auth-form-panel">
      <NuxtLink to="/" class="back-link">
        <UIcon name="i-heroicons-arrow-left" class="size-4" />
        Back to home
      </NuxtLink>

      <div class="auth-card">
        <BrandLogo :size="44" center class="auth-card-mark" />

        <h1 class="auth-headline">Sign in to Verify</h1>
        <p class="auth-portal">{{ portalLabel }}</p>

        <button
          type="button"
          class="google-btn"
          :disabled="oauthLoading"
          @click="onGoogleClick"
        >
          <UIcon
            v-if="oauthLoading"
            name="i-heroicons-arrow-path"
            class="size-4 spin"
          />
          <svg v-else class="size-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C40.945 35.826 44 30.5 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          <span>{{ oauthLoading ? 'Connecting…' : 'Continue with Google' }}</span>
        </button>

        <div class="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form class="auth-form" @submit.prevent="onSubmit">
          <div class="field">
            <label class="field-label" for="email">Email</label>
            <UInput
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              icon="i-heroicons-envelope"
              size="lg"
              class="w-full"
              :disabled="loading"
            />
          </div>

          <div class="field">
            <div class="field-head">
              <label class="field-label" for="password">Password</label>
              <NuxtLink to="/auth/forgot-password" class="forgot-link">
                Forgot password?
              </NuxtLink>
            </div>
            <UInput
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              icon="i-heroicons-lock-closed"
              size="lg"
              class="w-full"
              :disabled="loading"
            />
          </div>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-heroicons-exclamation-triangle"
            title="Invalid email or password."
          />

          <!-- The credentials were right and the account is real; it is simply
               switched off. Saying so beats an unexplained bounce back to this
               same form. -->
          <UAlert
            v-if="notice"
            color="error"
            variant="subtle"
            icon="i-heroicons-lock-closed"
            title="Cannot sign in"
            :description="notice"
          />

          <!-- Signing in worked; the API did not answer. Distinguishing this from
               bad credentials is the difference between a five-minute fix and an
               hour of doubting the password. -->
          <UAlert
            v-if="apiError"
            color="warning"
            variant="subtle"
            icon="i-heroicons-signal-slash"
            title="Signed in, but the Verify API is not responding"
            :description="`Could not reach ${apiBase}. Start the backend with 'cd backend && npm run dev', then try again.`"
          />

          <button type="submit" class="submit-btn" :disabled="loading">
            <UIcon
              v-if="loading"
              name="i-heroicons-arrow-path"
              class="size-4 spin"
            />
            <span>{{ loading ? 'Signing in…' : 'Sign in' }}</span>
            <UIcon
              v-if="!loading"
              name="i-heroicons-arrow-right"
              class="size-4 submit-arrow"
            />
          </button>
        </form>

        <!--
          Two different "I have no account" situations, and conflating them sent
          certificate holders to an administrator who has nothing to give them:
          a holder's account is created by claiming a certificate, not by staff.
        -->
        <div class="auth-foot">
          <p class="foot-line">
            <UIcon name="i-heroicons-academic-cap" class="size-3.5" />
            Received a certificate? Open the claim link your institution emailed
            you to set up your account.
          </p>
          <p class="foot-line">
            <UIcon name="i-heroicons-building-library" class="size-3.5" />
            Institution staff accounts are created by your platform administrator.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: var(--canvas-app);
}

/* ── Brand panel ── */
/*
 * The watercolour art sits UNDER the brand gradient rather than replacing it.
 *
 * Layer order in the shorthand is front-to-back, so the gradient is listed
 * first and the texture second. The gradient uses the same two greens it
 * always did, just with alpha, which is what keeps the white headline at full
 * contrast — the art only shows through as tone and the leaf shapes at the
 * edges, and never lands raw behind text.
 *
 * `background-color` underneath is the fallback: if the WebP never arrives the
 * panel is the flat deep green it was before, not a bare white column.
 *
 * The veil is thinner than it looks like it should be because the art is
 * DARKER than the gradient exactly where the copy sits — sampled behind
 * .brand-copy it is rgb(10,55,58), against the gradient's #0A5C52. Letting
 * more of it through therefore raises contrast rather than lowering it:
 * headline 8.4:1 and sub 5.3:1 here, versus 7.9:1 and 5.0:1 on the flat
 * gradient this replaced. The pale leaf tips that would be a problem sit out
 * at the panel edges, clear of any text.
 */
.auth-brand {
  position: relative;
  overflow: hidden;
  background-color: #0A5C52;
  background-image:
    linear-gradient(135deg, rgba(10, 92, 82, 0.74) 0%, rgba(5, 53, 48, 0.84) 100%),
    url('/bg-auth.webp');
  background-size: cover, cover;
  background-position: center, center;
  color: var(--rail-text);
  padding: 44px 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Two soft radial washes keep the flat gradient from reading as a solid slab */
.brand-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(620px 420px at 78% 12%, rgba(92, 170, 160, 0.30), transparent 70%),
    radial-gradient(520px 380px at 8% 92%, rgba(15, 123, 108, 0.38), transparent 72%);
  pointer-events: none;
}

.brand-top,
.brand-copy,
.brand-points {
  position: relative;
  z-index: 1;
}

.brand-top {
  color: var(--rail-text-strong);
}

.brand-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--rail-text-dim);
  margin: 0 0 14px;
}

.brand-headline {
  font-size: 36px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--rail-text-strong);
  margin: 0 0 16px;
  max-width: 11ch;
}

.brand-sub {
  font-size: 15px;
  line-height: 1.65;
  color: var(--rail-text);
  opacity: 0.85;
  margin: 0;
  max-width: 42ch;
}

.brand-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brand-points li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: var(--rail-text);
  opacity: 0.9;
}

.point-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #7FD3C5;
}

/* ── Form panel ── */
.auth-form-panel {
  position: relative;
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

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
  padding: 36px 34px 30px;
}

/* Centering is the component's own `center` prop — see BrandLogo.vue for why
   it cannot be done from out here. Spacing only. */
.auth-card-mark {
  margin-bottom: 20px;
}

.auth-headline {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  text-align: center;
  margin: 0;
}

.auth-portal {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin: 6px 0 0;
}

.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-top: 26px;
  padding: 10px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.google-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-light);
}

.google-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.google-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.auth-divider span {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.auth-form {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.forgot-link {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  margin-bottom: 6px;
}

.forgot-link:hover { text-decoration: underline; }

.forgot-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}

.field-label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
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
  transition: transform var(--transition-fast), box-shadow var(--transition-fast),
              opacity var(--transition-fast);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -12px rgba(10, 92, 82, 0.7);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.submit-arrow {
  transition: transform var(--transition-fast);
}

.submit-btn:hover:not(:disabled) .submit-arrow {
  transform: translateX(3px);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-foot {
  margin: 22px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.foot-line {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary);
  margin: 0;
  text-align: left;
}

.foot-line :deep(svg) {
  flex-shrink: 0;
  margin-top: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .back-link:hover,
  .submit-btn:hover:not(:disabled),
  .submit-btn:hover:not(:disabled) .submit-arrow {
    transform: none;
  }
  .spin { animation: none; }
}

/* ── Responsive: the brand panel is decoration, so it goes first ── */
@media (max-width: 900px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-brand {
    display: none;
  }

  .auth-form-panel {
    min-height: 100vh;
    padding-top: 84px;
  }

  .back-link {
    top: 20px;
    left: 20px;
  }
}
</style>
