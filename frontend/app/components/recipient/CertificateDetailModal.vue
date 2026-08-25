<script setup lang="ts">
import QrcodeVue from 'qrcode.vue'
import type { HolderCertificate } from '~/composables/useHolderCertificates'

const props = defineProps<{ open: boolean; cert: HolderCertificate | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const copied = ref<'id' | 'url' | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copy(which: 'id' | 'url', value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = which
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = null), 1600)
  } catch {
    // Clipboard is permission-gated and blocked outside a secure context;
    // the value is on screen and selectable either way.
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))

const certUrl = computed(() => (props.cert ? `${useRequestURL().origin}/cert/${props.cert.id}` : ''))

// LinkedIn's certification "Add to Profile" flow, not the generic link-share
// flow — this pre-fills a Licenses & Certifications entry with the cert's own
// details rather than just posting a link.
// https://www.linkedin.com/help/linkedin/answer/a566056
const linkedInShareUrl = computed(() => {
  if (!props.cert) return ''
  const issued = new Date(props.cert.issued_at)
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: props.cert.course_name,
    organizationName: props.cert.institution_name,
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: certUrl.value,
    certId: props.cert.id,
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}
</script>

<template>
  <UModal :open="open" title="Certificate details" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="cert" class="space-y-4">
        <div v-if="cert.badge_url" class="badge-hero">
          <img :src="cert.badge_url" alt="" class="badge-hero-image" loading="lazy" decoding="async" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs mb-0.5 detail-label">Course</p>
            <p class="text-sm font-medium detail-value">{{ cert.course_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Institution</p>
            <p class="text-sm font-medium detail-value">{{ cert.institution_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Status</p>
            <UiStatusChip :status="cert.status" />
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Completed</p>
            <p class="text-sm font-medium detail-value">{{ formatDate(cert.completion_date) }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Expiry</p>
            <p class="text-sm font-medium detail-value">{{ cert.expiry_date ? formatDate(cert.expiry_date) : 'No expiry' }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Issued</p>
            <p class="text-sm font-medium detail-value">{{ formatDate(cert.issued_at) }}</p>
          </div>
        </div>

        <!--
          The ID and the link are the two things a holder is asked for, so both
          copy in one click. Reading a UUID off the screen to type elsewhere is
          where verification actually falls down.
        -->
        <div class="pt-4 detail-divider space-y-3">
          <div>
            <p class="text-xs mb-1 detail-label">Certificate ID</p>
            <div class="copy-row">
              <code class="copy-value">{{ cert.id }}</code>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="copied === 'id' ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
                :aria-label="copied === 'id' ? 'Certificate ID copied' : 'Copy certificate ID'"
                @click="copy('id', cert.id)"
              />
            </div>
          </div>

          <div>
            <p class="text-xs mb-1 detail-label">Verification link</p>
            <div class="copy-row">
              <code class="copy-value">{{ certUrl }}</code>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="copied === 'url' ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
                :aria-label="copied === 'url' ? 'Link copied' : 'Copy verification link'"
                @click="copy('url', certUrl)"
              />
            </div>
            <p class="text-xs mt-1 detail-label">
              Anyone can open this — no account needed.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-4 pt-4 detail-divider">
          <ClientOnly>
            <QrcodeVue :value="certUrl" :size="140" level="M" />
            <template #fallback>
              <div class="qr-placeholder" />
            </template>
          </ClientOnly>
          <div class="flex-1 space-y-2 min-w-0">
            <p class="text-xs detail-label">Scan to open the public certificate page, or share it directly.</p>
            <UButton
              :to="linkedInShareUrl"
              target="_blank"
              variant="outline"
              color="neutral"
              size="sm"
              icon="i-heroicons-arrow-up-on-square"
            >
              Share to LinkedIn
            </UButton>
            <p v-if="cert.status === 'valid'" class="text-xs blockchain-note">
              Recorded on the Polygon blockchain · {{ formatTimestamp(cert.issuedAtBlockchainTimestamp) }}
            </p>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          variant="ghost"
          color="neutral"
          :to="`/cert/${cert?.id}`"
          target="_blank"
          icon="i-heroicons-arrow-top-right-on-square"
        >
          Open public page
        </UButton>
        <UButton color="neutral" variant="outline" @click="emit('update:open', false)">Close</UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
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
}

.badge-hero {
  display: flex;
  justify-content: center;
  padding: 4px 0 2px;
}
.badge-hero-image {
  width: 88px;
  height: 88px;
  object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.16));
  animation: badge-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes badge-pop {
  from { opacity: 0; transform: scale(0.85) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .badge-hero-image { animation: none; }
}
.detail-label { color: var(--text-tertiary); }
.detail-value { color: var(--text-primary); }
.detail-divider { border-top: 1px solid var(--border); }
.blockchain-note { color: var(--text-tertiary); }
.qr-placeholder { width: 140px; height: 140px; background: var(--surface-hover); border-radius: 0.5rem; }
</style>
