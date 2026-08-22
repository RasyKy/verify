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
  <div class="min-h-screen page-ground">
    <div class="max-w-xl mx-auto px-4 pt-20 pb-16">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <BrandLogo :size="32" wordmark />
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
