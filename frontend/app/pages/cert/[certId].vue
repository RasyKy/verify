<script setup lang="ts">
import QrcodeVue from 'qrcode.vue'
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

// This page's own URL — the canonical public link for a certificate, shared
// via "Open public page" and the QR code in the issuer/recipient portals.
const certUrl = computed(() => `${useRequestURL().origin}/cert/${certId}`)
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
          certificate right now. This does not mean it is invalid — please try again
          shortly.
        </p>
        <UButton class="mt-4" variant="soft" color="neutral" @click="refreshNuxtData()">
          Try again
        </UButton>
      </div>

      <template v-else>
        <!-- Result card -->
        <VerifyResultCard :result="displayResult" :loading="pending" />

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
          <p class="text-xs text-gray-500 flex-1 min-w-0">
            Scan this code to open this certificate's public page directly.
          </p>
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
</style>
