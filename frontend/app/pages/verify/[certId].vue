<script setup lang="ts">
import type { VerifyResult } from '~/composables/useVerify'

definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const certId = route.params.certId as string
const { public: { apiBase } } = useRuntimeConfig()

// Public endpoint — no bearer token, so plain useFetch rather than useApi().
// SSR-rendered so a shared link shows the verdict without a client round-trip.
const { data: displayResult, pending, error } = useFetch<VerifyResult>(
  () => `/api/certificates/verify/${certId}`,
  { baseURL: apiBase, default: () => null },
)

/**
 * A 503 means we could not reach Supabase or the chain — NOT that the
 * certificate is fake. Conflating the two would tell someone holding a genuine
 * credential that it is forged because a node provider blipped, so this gets its
 * own state rather than falling through to the "invalid" card.
 */
const unavailable = computed(() => Boolean(error.value))

// For "verify another certificate" bar below the result
const newCertId = ref('')
const qrModalOpen = ref(false)

function onNewSearch() {
  const id = newCertId.value.trim()
  if (id) navigateTo(`/verify/${id}`)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-xl mx-auto px-4 pt-16 pb-16">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <NuxtLink to="/verify" class="flex items-center gap-2.5">
          <div class="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
            <span class="text-white font-bold text-sm leading-none">V</span>
          </div>
          <span class="font-semibold text-gray-900">Verify</span>
        </NuxtLink>
      </div>

      <!-- Heading -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Verify a certificate</h1>
        <p class="text-sm text-gray-500 mt-2">
          Enter a certificate ID or scan a QR code to confirm its authenticity.
        </p>
      </div>

      <!-- Service unavailable — deliberately NOT rendered as "invalid" -->
      <div
        v-if="unavailable"
        class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="size-8 text-amber-600" />
        <h2 class="mt-3 text-base font-semibold text-gray-900">
          Verification is temporarily unavailable
        </h2>
        <p class="mt-1.5 text-sm text-gray-600">
          We could not reach the verification service, so we cannot confirm this
          certificate right now. This does not mean it is invalid — please try again
          shortly.
        </p>
        <UButton class="mt-4" variant="soft" color="neutral" @click="refreshNuxtData()">
          Try again
        </UButton>
      </div>

      <!-- Result card -->
      <VerifyResultCard v-else :result="displayResult" :loading="pending" />

      <!-- Verify another certificate -->
      <div class="mt-8">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex-1 h-px bg-gray-200" />
          <span class="text-xs text-gray-400 shrink-0">Verify another certificate</span>
          <div class="flex-1 h-px bg-gray-200" />
        </div>
        <VerifySearchBar v-model="newCertId" @submit="onNewSearch" />
        <div class="flex justify-center mt-3">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-qr-code"
            size="sm"
            @click="qrModalOpen = true"
          >
            Scan QR code instead
          </UButton>
        </div>
      </div>
    </div>

    <!-- QR scanner modal -->
    <VerifyQrScannerModal v-model:open="qrModalOpen" />
  </div>
</template>
