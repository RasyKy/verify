<script setup lang="ts">
import QrcodeVue from 'qrcode.vue'
import type { HolderCertificate } from '~/composables/useHolderCertificates'

const props = defineProps<{ open: boolean; cert: HolderCertificate | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const statusConfig: Record<'valid' | 'revoked' | 'expired', { label: string; style: string }> = {
  valid: { label: 'Valid', style: 'background: var(--status-valid-bg); color: var(--status-valid-text)' },
  revoked: { label: 'Revoked', style: 'background: var(--status-revoked-bg); color: var(--status-revoked-text)' },
  expired: { label: 'Expired', style: 'background: var(--status-expired-bg); color: var(--status-expired-text)' },
}

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
            <span :style="statusConfig[cert.status].style" class="text-xs font-medium px-2 py-0.5 rounded-full">
              {{ statusConfig[cert.status].label }}
            </span>
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

        <div class="pt-4 detail-divider">
          <p class="text-xs mb-0.5 detail-label">Certificate ID</p>
          <p class="text-xs font-mono break-all detail-value">{{ cert.id }}</p>
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
.detail-label { color: var(--text-tertiary); }
.detail-value { color: var(--text-primary); }
.detail-divider { border-top: 1px solid var(--border); }
.blockchain-note { color: var(--text-tertiary); }
.qr-placeholder { width: 140px; height: 140px; background: var(--surface-hover); border-radius: 0.5rem; }
</style>
