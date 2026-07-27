<script setup lang="ts">
import type { RecipientCert } from '~/composables/useRecipientMockData'

definePageMeta({ layout: 'recipient' })

const { certs, totalCerts, hiddenCount, publicCount, toggleHidden } = useRecipientMockData()

const selectedCert = ref<RecipientCert | null>(null)
const modalOpen = ref(false)

function openDetail(id: string) {
  selectedCert.value = certs.value.find((c) => c.id === id) ?? null
  modalOpen.value = true
}
</script>

<template>
  <div>
    <AdminPageHeader
      title="My Certificates"
      description="View your credentials and control what's visible in public listings."
    />

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <AdminStatCard label="Total certificates" :value="totalCerts" icon="i-heroicons-document-text" tint="blue" />
      <AdminStatCard label="Public" :value="publicCount" icon="i-heroicons-eye" tint="green" />
      <AdminStatCard label="Hidden" :value="hiddenCount" icon="i-heroicons-eye-slash" tint="amber" />
    </div>

    <div v-if="certs.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RecipientCertificateCard
        v-for="cert in certs"
        :key="cert.id"
        :cert="cert"
        @view="openDetail"
        @toggle-hidden="toggleHidden"
      />
    </div>
    <div v-else class="empty-state">
      <UIcon name="i-heroicons-document-text" class="size-8" />
      <p>No certificates yet. Certificates you claim will appear here.</p>
    </div>

    <RecipientCertificateDetailModal v-model:open="modalOpen" :cert="selectedCert" />
  </div>
</template>

<style scoped>
.empty-state {
  color: var(--text-tertiary);
  text-align: center;
  padding: 4rem 0;
}
</style>
