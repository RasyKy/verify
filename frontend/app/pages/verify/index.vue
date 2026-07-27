<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const certId = ref('')
const qrModalOpen = ref(false)

function onSubmit() {
  const id = certId.value.trim()
  if (id) navigateTo(`/verify/${id}`)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-xl mx-auto px-4 pt-20 pb-16">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <div class="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
          <span class="text-white font-bold text-sm leading-none">V</span>
        </div>
        <span class="font-semibold text-gray-900">Verify</span>
      </div>

      <!-- Heading -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Verify a certificate</h1>
        <p class="text-sm text-gray-500 mt-2">
          Enter a certificate ID or scan a QR code to confirm its authenticity.
        </p>
      </div>

      <!-- Search bar -->
      <VerifySearchBar v-model="certId" @submit="onSubmit" />

      <!-- QR scan button -->
      <div class="flex justify-center mt-4">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-heroicons-qr-code"
          @click="qrModalOpen = true"
        >
          Scan QR code instead
        </UButton>
      </div>
    </div>

    <!-- QR scanner modal -->
    <VerifyQrScannerModal v-model:open="qrModalOpen" />
  </div>
</template>
