<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()

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
      await navigateTo('/issuer')
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
      <p class="text-sm text-gray-500 text-center mt-1">Institution issuer portal</p>

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
