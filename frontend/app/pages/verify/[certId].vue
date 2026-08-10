<script setup lang="ts">
import { lookupCertificate } from '~/composables/useVerifyMockData'

definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const certId = route.params.certId as string

const displayResult = computed(() => lookupCertificate(certId))

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

      <!-- Result card -->
      <VerifyResultCard :result="displayResult" :loading="false" />

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
