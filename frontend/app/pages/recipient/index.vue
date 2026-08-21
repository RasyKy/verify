<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

definePageMeta({ layout: 'recipient' })

const { certificates } = useHolderCertificates()
const me = useMe()

// Hide/unhide has no backend write yet (FR-HOLD-06) — this overlay is a
// local, session-only visual stub layered on top of the real is_hidden
// value, kept separate from `certificates` so refresh() doesn't fight it.
const hiddenOverrides = ref<Record<string, boolean>>({})

const displayCerts = computed<HolderCertificate[]>(() =>
  certificates.value.map((cert) => ({
    ...cert,
    is_hidden: hiddenOverrides.value[cert.id] ?? cert.is_hidden,
  })),
)

function toggleHidden(id: string) {
  const current = hiddenOverrides.value[id] ?? certificates.value.find((c) => c.id === id)?.is_hidden ?? false
  hiddenOverrides.value = { ...hiddenOverrides.value, [id]: !current }
}

const selectedCert = ref<HolderCertificate | null>(null)
const modalOpen = ref(false)

function openDetail(id: string) {
  selectedCert.value = displayCerts.value.find((c) => c.id === id) ?? null
  modalOpen.value = true
}

const totalCerts = computed(() => displayCerts.value.length)
const hiddenCount = computed(() => displayCerts.value.filter((c) => c.is_hidden).length)

const initials = computed(() => {
  const name = displayName(me.value)
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const summaryLine = computed(() => {
  const count = `${totalCerts.value} certificate${totalCerts.value === 1 ? '' : 's'}`
  return hiddenCount.value ? `${count} · ${hiddenCount.value} hidden` : count
})
</script>

<template>
  <div>
    <!-- Profile header -->
    <div class="profile-header">
      <div class="avatar">{{ initials }}</div>
      <h1 class="profile-name">{{ displayName(me) }}</h1>
      <p class="profile-summary">{{ summaryLine }}</p>
    </div>

    <h2 class="section-heading">My Certificates</h2>

    <div v-if="displayCerts.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RecipientCertificateCard
        v-for="(cert, index) in displayCerts"
        :key="cert.id"
        class="card-in"
        :style="{ '--i': index }"
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
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-bottom: 40px;
  margin-bottom: 32px;
  border-bottom: 1px solid var(--border);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
}

.profile-name {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-summary {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.section-heading {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.empty-state {
  color: var(--text-tertiary);
  text-align: center;
  padding: 4rem 0;
}
</style>
