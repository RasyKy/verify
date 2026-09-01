<script setup lang="ts">
import type { VerifyResult } from '~/composables/useVerify'

// Lazy, not a static import: this renders inside <ClientOnly> already (the
// QR code needs no SSR pass), but a static import still bundles the ~20KB
// library into this route's chunk for every visitor — including anonymous
// ones who never look at the code. Same pattern as the QR *scanner* in
// components/verify/QrScannerModal.vue, which already does this correctly.
const QrcodeVue = defineAsyncComponent(() => import('qrcode.vue'))

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

// This page's own URL — the canonical public link for a certificate, shared
// via "Open public page" and the QR code in the issuer/recipient portals.
const certUrl = computed(() => `${useRequestURL().origin}/cert/${certId}`)

// Rendered server-side (GET /api/certificates/:id/download) — a plain link,
// since the browser handles the Content-Disposition download natively.
// Public and unauthenticated, same as the QR endpoint.
function downloadUrl(format: 'pdf' | 'png') {
  return `${apiBase}/api/certificates/${certId}/download?format=${format}`
}

// Same endpoint as "Download PNG" — an <img> tag ignores the response's
// Content-Disposition: attachment, so it renders inline here instead of
// triggering a save dialog.
const previewLoaded = ref(false)
const previewFailed = ref(false)
</script>

<template>
  <div class="min-h-screen page-ground">
    <div class="max-w-xl mx-auto px-4 pt-16 pb-16">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <NuxtLink to="/verify" aria-label="Verify: home">
          <BrandLogo :size="32" wordmark />
        </NuxtLink>
      </div>

      <!-- Heading -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Certificate</h1>
        <p class="text-sm text-gray-500 mt-2">
          This is the public record for this certificate.
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
          certificate right now. This does not mean it is invalid. Please try again
          shortly.
        </p>
        <UButton class="mt-4" variant="soft" color="neutral" @click="refreshNuxtData()">
          Try again
        </UButton>
      </div>

      <template v-else>
        <!-- Result card -->
        <VerifyResultCard :result="displayResult" :loading="pending" />

        <!-- The rendered template itself, not just the data card above -->
        <div v-if="!pending && displayResult?.certificate" class="mt-6 preview-frame">
          <div v-if="!previewLoaded && !previewFailed" class="preview-skeleton" />
          <p v-if="previewFailed" class="preview-fallback">
            Preview unavailable right now. The PDF/PNG downloads below still work.
          </p>
          <img
            v-show="previewLoaded"
            :src="downloadUrl('png')"
            :alt="`${displayResult.certificate.courseName} certificate`"
            class="preview-image"
            @load="previewLoaded = true"
            @error="previewFailed = true"
          >
        </div>

        <!-- QR code -->
        <div
          v-if="!pending && displayResult?.certificate"
          class="mt-6 rounded-xl border border-gray-200 bg-white p-6 flex items-center gap-4"
        >
          <ClientOnly>
            <QrcodeVue :value="certUrl" :size="140" level="M" />
            <template #fallback>
              <div class="qr-placeholder" />
            </template>
          </ClientOnly>
          <div class="flex-1 min-w-0 space-y-2">
            <p class="text-xs text-gray-500">
              Scan this code to open this certificate's public page directly.
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton :to="downloadUrl('pdf')" target="_blank" variant="soft" color="neutral" size="sm" icon="i-heroicons-document-arrow-down">
                Download PDF
              </UButton>
              <UButton :to="downloadUrl('png')" target="_blank" variant="soft" color="neutral" size="sm" icon="i-heroicons-photo">
                Download PNG
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.qr-placeholder {
  width: 140px;
  height: 140px;
  background: var(--surface-hover);
  border-radius: 0.5rem;
}

.preview-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1.414 / 1;
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--surface-hover);
  border: 1px solid var(--border);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--surface-hover) 25%, var(--surface) 50%, var(--surface-hover) 75%);
  background-size: 200% 100%;
  animation: preview-shimmer 1.4s ease-in-out infinite;
}

@keyframes preview-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.preview-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .preview-skeleton { animation: none; }
}
</style>
