<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

definePageMeta({ layout: 'recipient' })

const toast = useToast()
const { certificates, refresh: refreshCertificates } = useHolderCertificates()
const { profile, refresh: refreshProfile } = useHolderProfile()
const me = useMe()

async function toggleHidden(id: string, isHidden: boolean) {
  try {
    await setCertificateVisibility(id, isHidden)
    toast.add({ title: isHidden ? 'Certificate hidden' : 'Certificate made public', color: 'success' })
    refreshCertificates()
  } catch (err) {
    toast.add({ title: 'Could not update certificate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function toggleProfilePublic(isPublic: boolean) {
  try {
    await setProfileVisibility(isPublic)
    toast.add({ title: isPublic ? 'Profile made public' : 'Profile made private', color: 'success' })
    refreshProfile()
  } catch (err) {
    toast.add({ title: 'Could not update profile', description: apiErrorMessage(err), color: 'error' })
  }
}

const selectedCert = ref<HolderCertificate | null>(null)
const modalOpen = ref(false)

function openDetail(id: string) {
  selectedCert.value = certificates.value.find((c) => c.id === id) ?? null
  modalOpen.value = true
}

const totalCerts = computed(() => certificates.value.length)
const hiddenCount = computed(() => certificates.value.filter((c) => c.is_hidden).length)

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

/**
 * The holder's own public profile URL.
 *
 * Shown here because the two visibility toggles are otherwise unfalsifiable
 * from this screen: without a link to the page they govern, "Public" and
 * "Hidden" are claims the holder has no way to check. useRequestURL() inside a
 * computed matches CertificateDetailModal.vue's certUrl.
 */
const profileUrl = computed(() =>
  me.value ? publicProfileUrl(useRequestURL().origin, me.value.id) : '',
)

const copiedProfileUrl = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyProfileUrl() {
  try {
    await navigator.clipboard.writeText(profileUrl.value)
    copiedProfileUrl.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copiedProfileUrl.value = false), 1600)
  } catch {
    // Clipboard is permission-gated and blocked outside a secure context;
    // the URL is on screen and selectable either way.
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <div>
  <div class="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-8">
    <!-- Main: certificates is the one loud element on the page -->
    <div class="min-w-0">
      <h1 class="page-title text-2xl font-semibold mb-6">Certificates</h1>

      <div v-if="certificates.length" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div v-else class="empty-state">
        <UIcon name="i-heroicons-document-text" class="size-8" />
        <p>No certificates yet. Certificates you claim will appear here.</p>
      </div>
    </div>

    <!-- Sidebar: identity and sharing, demoted out of the way -->
    <aside class="sidebar-card p-5 h-fit lg:sticky lg:top-20">
      <div class="flex items-center gap-3">
        <UAvatar :text="initials" class="size-11 shrink-0" style="background: var(--surface); color: var(--text-primary); border: 1px solid var(--border)" />
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate identity-name">{{ displayName(me) }}</p>
          <p class="text-xs identity-summary">{{ summaryLine }}</p>
        </div>
      </div>

      <div class="mt-4 pt-4 sidebar-divider">
        <div class="flex items-center justify-between gap-2">
          <USwitch
            v-if="profile"
            :model-value="profile.profile_is_public"
            :label="profile.profile_is_public ? 'Public profile' : 'Private profile'"
            size="sm"
            @update:model-value="toggleProfilePublic"
          />
          <UButton
            v-if="profile?.profile_is_public && profileUrl"
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="copiedProfileUrl ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
            :aria-label="copiedProfileUrl ? 'Profile link copied' : 'Copy profile link'"
            @click="copyProfileUrl"
          />
        </div>
        <p v-if="profile?.profile_is_public && profileUrl" class="text-xs mt-2 identity-summary">
          Anyone with this link sees your {{ totalCerts - hiddenCount }} public certificate{{ totalCerts - hiddenCount === 1 ? '' : 's' }}.
        </p>
        <p v-else-if="profile" class="text-xs mt-2 identity-summary">
          Your profile page is off. Direct certificate links still work.
        </p>
      </div>

      <UButton
        block
        class="mt-4"
        trailing-icon="i-heroicons-arrow-top-right-on-square"
        :to="`/p/${me?.id}`"
        target="_blank"
      >
        View public profile
      </UButton>
    </aside>
  </div>

  <RecipientCertificateDetailModal v-model:open="modalOpen" :cert="selectedCert" />
  </div>
</template>

<style scoped>
.page-title {
  font-family: var(--font-display);
  color: var(--text-primary);
}

.sidebar-card {
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
}

.sidebar-divider {
  border-top: 1px solid var(--border);
}

.identity-name {
  color: var(--text-primary);
}

.identity-summary {
  color: var(--text-tertiary);
}

.empty-state {
  color: var(--text-tertiary);
  text-align: center;
  padding: 4rem 0;
}
</style>
