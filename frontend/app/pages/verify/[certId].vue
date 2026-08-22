<script setup lang="ts">
import { useVerifyCertificate } from '~/composables/useVerifyCertificate'

definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
// A getter, not a snapshot: navigating from /verify/a to /verify/b reuses this
// component, so reading the param once would leave the first result on screen.
const certId = computed(() => route.params.certId as string)

const { result, pending, error } = useVerifyCertificate(certId)

// For "verify another certificate" bar below the result
const newCertId = ref('')
const qrModalOpen = ref(false)

function onNewSearch() {
  const id = newCertId.value.trim()
  if (id) navigateTo(`/verify/${id}`)
}
</script>

<template>
  <div class="min-h-screen page-ground">
    <div class="max-w-xl mx-auto px-4 pt-16 pb-16">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <NuxtLink to="/verify" aria-label="Verify — home">
          <BrandLogo :size="32" wordmark />
        </NuxtLink>
      </div>

      <!-- Heading -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Verify a certificate</h1>
        <p class="text-sm text-gray-500 mt-2">
          Enter a certificate ID or scan a QR code to confirm its authenticity.
        </p>
      </div>

      <!--
        A service failure is shown as its own state, never as an unverified
        result: telling an employer a genuine credential is fake is far worse
        than admitting the service is briefly unreachable.
      -->
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        title="Verification is temporarily unavailable"
        description="We could not reach the verification service. This does not mean the certificate is invalid — please try again shortly."
      />
      <VerifyResultCard v-else :result="result" :loading="pending" />

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
