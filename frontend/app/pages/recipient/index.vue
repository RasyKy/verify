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
    <!-- Profile header -->
    <div class="profile-header">
      <div class="avatar">{{ initials }}</div>
      <h1 class="profile-name">{{ displayName(me) }}</h1>
      <p class="profile-summary">{{ summaryLine }}</p>
      <USwitch
        v-if="profile"
        class="profile-visibility"
        :model-value="profile.profile_is_public"
        :label="profile.profile_is_public ? 'Public profile' : 'Private profile'"
        size="sm"
        @update:model-value="toggleProfilePublic"
      />

      <!-- What the toggles above actually control. -->
      <div v-if="profile?.profile_is_public && profileUrl" class="profile-link">
        <div class="copy-row">
          <code class="copy-value">{{ profileUrl }}</code>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="copiedProfileUrl ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
            :aria-label="copiedProfileUrl ? 'Profile link copied' : 'Copy profile link'"
            @click="copyProfileUrl"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-arrow-top-right-on-square"
            :to="`/p/${me?.id}`"
            target="_blank"
            aria-label="Open my public profile"
          />
        </div>
        <p class="profile-link-note">
          Anyone with this link sees your
          {{ totalCerts - hiddenCount }} public
          certificate{{ totalCerts - hiddenCount === 1 ? '' : 's' }}. Hidden ones
          stay off it — but keep working as direct verification links.
        </p>
      </div>
      <p v-else-if="profile" class="profile-link-note profile-link-off">
        Your profile page is off. Individual certificate links still work for
        anyone you send them to.
      </p>
    </div>

    <h2 class="section-heading">My Certificates</h2>

    <div v-if="certificates.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

.profile-visibility {
  margin-top: 16px;
}

.profile-link {
  margin-top: 16px;
  width: 100%;
  max-width: 440px;
}

.copy-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-hover);
}

.copy-value {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11.5px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.profile-link-note {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 8px;
  line-height: 1.5;
}

.profile-link-off {
  margin-top: 16px;
  max-width: 440px;
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
