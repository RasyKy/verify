<script setup lang="ts">
import { fetchCurrentUser, HOME_FOR_ROLE } from '~/composables/useCurrentUser'

/**
 * Where an invited issuer lands.
 *
 * The admin never chooses a password (see backend/src/services/adminService.js)
 * — Supabase emails a one-time link, and clicking it drops a short-lived
 * session in the URL. supabase-js picks that up automatically; this page turns
 * it into a permanent credential the invitee has chosen themselves.
 *
 * Also serves a password reset, which arrives the same way.
 */
definePageMeta({ layout: false })

useHead({
  // A link with a live session in it must never end up in a search index.
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const errorMessage = ref('')

/**
 * The session arrives asynchronously: supabase-js parses the URL fragment after
 * mount, so `user` is null for the first tick. Waiting avoids telling a
 * perfectly valid invitee that their link is broken.
 */
const ready = ref(false)
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    // Give the client a moment to consume the fragment, then check once more.
    await new Promise((resolve) => setTimeout(resolve, 600))
  }
  ready.value = true
})

const hasSession = computed(() => Boolean(user.value))

const problem = computed(() => {
  if (!password.value) return null
  if (password.value.length < 8) return 'Password must be at least 8 characters'
  if (confirm.value && password.value !== confirm.value) return 'Passwords do not match'
  return null
})

const canSubmit = computed(
  () => password.value.length >= 8 && password.value === confirm.value && !submitting.value,
)

async function onSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) {
      errorMessage.value = error.message
      return
    }
    // Force a refetch: this is the first time the profile is being read, and
    // the cache is empty or stale from the invite session.
    const profile = await fetchCurrentUser(true)
    await navigateTo(profile ? HOME_FOR_ROLE[profile.role] : '/login')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen page-ground flex items-center justify-center px-4">
    <div class="max-w-sm w-full surface-panel p-8">
      <div class="flex justify-center mb-5">
        <BrandLogo :size="40" />
      </div>

      <template v-if="!ready">
        <p class="text-sm text-gray-500 text-center py-6">Checking your invitation…</p>
      </template>

      <template v-else-if="!hasSession">
        <h1 class="text-lg font-medium text-gray-900 text-center">
          This link is no longer valid
        </h1>
        <p class="text-sm text-gray-500 text-center mt-2">
          Invitation links expire after a short time and can only be used once. Ask your
          administrator to send a new invitation.
        </p>
        <UButton to="/login" class="w-full justify-center mt-6" color="neutral" variant="soft">
          Back to sign in
        </UButton>
      </template>

      <template v-else>
        <h1 class="text-lg font-medium text-gray-900 text-center">Choose a password</h1>
        <p class="text-sm text-gray-500 text-center mt-1">
          {{ user?.email }}
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="password">
              New password
            </label>
            <UInput
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              placeholder="At least 8 characters"
              class="w-full bg-white"
              :disabled="submitting"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="confirm">
              Confirm password
            </label>
            <UInput
              id="confirm"
              v-model="confirm"
              type="password"
              autocomplete="new-password"
              class="w-full bg-white"
              :disabled="submitting"
            />
          </div>

          <p v-if="problem" class="text-sm text-amber-600">{{ problem }}</p>
          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

          <UButton
            type="submit"
            class="w-full justify-center"
            color="primary"
            :loading="submitting"
            :disabled="!canSubmit"
          >
            Set password and continue
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>
