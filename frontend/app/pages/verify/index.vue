<script setup lang="ts">
/**
 * The standalone entry point for verification.
 *
 * Runs without a layout (no marketing header), because this is the page a QR
 * code or a pasted link drops someone onto — so the way back to the rest of
 * the site has to be on the page itself. It carries the same search bar as the
 * landing hero rather than a smaller variant: this is the identical task, and
 * arriving here should not feel like a downgraded version of the front page.
 */
definePageMeta({ layout: false })

useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const certId = ref('')
const qrModalOpen = ref(false)

function onSubmit(id: string) {
  navigateTo(`/verify/${encodeURIComponent(id)}`)
}
</script>

<template>
  <div class="min-h-screen page-ground verify-page">
    <div class="verify-shell">
      <VerifyBackHomeLink class="back-slot" />

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

      <!-- Search bar — the same control the landing hero uses -->
      <div class="search-row">
        <VerifyHeroSearch
          v-model="certId"
          input-id="verify-cert-id"
          autofocus
          @submit="onSubmit"
        />
      </div>

      <!-- QR scan button -->
      <div class="flex justify-center mt-5">
        <button type="button" class="qr-btn" @click="qrModalOpen = true">
          <UIcon name="i-heroicons-qr-code" class="qr-icon" />
          Scan QR code instead
        </button>
      </div>
    </div>

    <!-- QR scanner modal -->
    <VerifyQrScannerModal v-model:open="qrModalOpen" />
  </div>
</template>

<style scoped>
.verify-page {
  padding: 28px 20px 64px;
}

.verify-shell {
  max-width: 660px;
  margin: 0 auto;
}

.back-slot {
  margin-bottom: 40px;
}

/* The bar caps itself at 620px; this centres it in the wider shell. */
.search-row {
  display: flex;
  justify-content: center;
}

/* Matches the landing hero's secondary action, so the two pages read as one
   product rather than two. */
.qr-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}

.qr-btn:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}

.qr-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.qr-icon {
  width: 15px;
  height: 15px;
}

</style>
