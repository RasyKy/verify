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
  return typeof r === 'string' && r in PORTAL_COPY ? r : '/issuer'
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

async function destinationAfterLogin(): Promise<string> {
  const me = await fetchMe()
  if (!me) return requestedRedirect.value
  const permitted = ROLE_PORTALS[me.role] ?? []
  return permitted.includes(requestedRedirect.value)
    ? requestedRedirect.value
    : (ROLE_HOME[me.role] ?? '/')
}

const email = ref('')
const password = ref('')
const error = ref(false)
const loading = ref(false)

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
      await navigateTo(await destinationAfterLogin())
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="max-w-sm w-full bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
      <!-- Logo -->
      <div class="flex justify-center mb-5">
        <div class="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-base leading-none">V</span>
        </div>
      </div>

      <!-- Heading -->
      <h1 class="text-lg font-medium text-gray-900 text-center">Sign in to Verify</h1>
      <p class="text-sm text-gray-500 text-center mt-1">
        {{ portalLabel }}
      </p>

      <!-- Form -->
      <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="email">
            Email
          </label>
          <UInput
            id="email"
            v-model="email"
            type="email"
            placeholder="you@institution.edu"
            autocomplete="email"
            class="w-full bg-white"
            :disabled="loading"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1" for="password">
            Password
          </label>
          <UInput
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            class="w-full bg-white"
            :disabled="loading"
          />
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          title="Invalid email or password."
        />

        <UButton
          type="submit"
          color="primary"
          class="w-full justify-center"
          :loading="loading"
        >
          Sign in
        </UButton>
      </form>

      <p class="text-xs text-gray-400 text-center mt-5">
        Don't have access? Contact your platform administrator.
      </p>
    </div>
  </div>
</template>
