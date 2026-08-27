<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

definePageMeta({ layout: 'recipient' })

const toast = useToast()
const { certificates, refresh: refreshCertificates } = useHolderCertificates()

async function toggleHidden(id: string, isHidden: boolean) {
  try {
    await setCertificateVisibility(id, isHidden)
    refreshCertificates()
  } catch (err) {
    // The switch itself already shows the new state — no need to also
    // toast on success. A failure is different: without this, the switch
    // would look flipped while the write silently didn't happen.
    toast.add({ title: 'Could not update certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

const selectedCert = ref<HolderCertificate | null>(null)
const modalOpen = ref(false)

function openDetail(id: string) {
  selectedCert.value = certificates.value.find((c) => c.id === id) ?? null
  modalOpen.value = true
}
</script>

<template>
  <div>
    <header class="dash-header mb-8">
      <div>
        <h1 class="dash-title">Certificates</h1>
        <p class="dash-subtitle">Everything you've claimed, all in one place.</p>
      </div>
    </header>

    <template v-if="certificates.length">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RecipientCertificateCard
          v-for="(cert, index) in certificates"
          :key="cert.id"
          class="card-in"
          :style="{ '--i': index }"
          :cert="cert"
          @view="openDetail"
          @toggle-hidden="toggleHidden"
        />
      </div>
    </template>
    <div v-else class="empty-state">
      <div class="empty-icon">
        <UIcon name="i-heroicons-document-text" class="size-6" />
      </div>
      <p class="empty-title">No certificates yet</p>
      <p class="empty-body">Certificates you claim will appear here. Check the email your institution sent you.</p>
    </div>

    <RecipientCertificateDetailModal v-model:open="modalOpen" :cert="selectedCert" />
  </div>
</template>

<style scoped>
/* ── Header — same shape as the issuer dashboard's .dash-header ── */
.dash-header {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.dash-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  margin: 0;
}

.dash-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 5px 0 0;
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  padding: 4rem 2rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-panel);
  background: var(--surface-hover);
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
  border-radius: 9999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-tertiary);
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-body {
  font-size: 13px;
  color: var(--text-tertiary);
  max-width: 320px;
}
</style>
