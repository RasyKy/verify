<script setup lang="ts">
import type { Role } from '~/composables/useMe'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const route = useRoute()

// Remembers which guarded portal sent the visitor here, so the heading names it
// and sign-in can return them there. Allowlisted rather than trusting the raw
// query value, to avoid an open-redirect via an arbitrary `?redirect=`.
const PORTAL_COPY: Record<string, string> = {
  '/recipient': 'Certificate recipient portal',
  '/admin': 'Platform admin portal',
}
const requestedRedirect = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r in PORTAL_COPY ? r : null
})
const portalLabel = computed(() => PORTAL_COPY[requestedRedirect.value] ?? 'Institution issuer portal')

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
  if (result.state !== 'ok') return requestedRedirect.value

  const permitted = ROLE_PORTALS[result.me.role] ?? []
  return permitted.includes(requestedRedirect.value)
    ? requestedRedirect.value
    : (ROLE_HOME[result.me.role] ?? '/')
}

const email = ref('')
const password = ref('')
const error = ref(false)
const loading = ref(false)
/** Set when sign-in succeeded but the backend could not be reached. */
const apiError = ref('')
const { public: { apiBase } } = useRuntimeConfig()

async function onSubmit() {
  if (!email.value || !password.value) return
  loading.value = true
  error.value = false
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (authError) {
      error.value = true
      password.value = ''
    } else {
      // A stale profile from a previous session would send this one to the
      // wrong portal.
      clearMe()
      const destination = await destinationAfterLogin()
      // null means the API is unreachable — apiError is showing why, so stay put.
      if (destination) await navigateTo(destination)
    }
  } finally {
    loading.value = false
  }
}
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
          the link can confirm it in seconds — without calling you.
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
        <BrandLogo :size="44" class="auth-card-mark" />

        <h1 class="auth-headline">Sign in to Verify</h1>
        <p class="auth-portal">{{ portalLabel }}</p>

        <form class="auth-form" @submit.prevent="onSubmit">
          <div class="field">
            <label class="field-label" for="email">Email</label>
            <UInput
              id="email"
              v-model="email"
              type="email"
              placeholder="you@institution.edu"
              autocomplete="email"
              icon="i-heroicons-envelope"
              size="lg"
              class="w-full"
              :disabled="loading"
            />
          </div>

          <div class="field">
            <label class="field-label" for="password">Password</label>
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

        <p class="auth-foot">
          <UIcon name="i-heroicons-information-circle" class="size-3.5" />
          No access yet? Your platform administrator creates accounts.
        </p>
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
.auth-brand {
  position: relative;
  overflow: hidden;
  background: var(--grad-deep);
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

.auth-card-mark {
  display: flex;
  justify-content: center;
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

.auth-form {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 22px 0 0;
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
