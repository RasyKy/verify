<script setup lang="ts">
interface Certificate {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  status: 'valid' | 'revoked' | 'expired' | 'unclaimed'
  issued_at: string
}

const props = defineProps<{
  open: boolean
  cert: Certificate | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const statusConfig: Record<string, { label: string; style: string }> = {
  valid:     { label: 'Valid',      style: 'background: var(--status-valid-bg);     color: var(--status-valid-text)' },
  revoked:   { label: 'Revoked',    style: 'background: var(--status-revoked-bg);   color: var(--status-revoked-text)' },
  expired:   { label: 'Expired',    style: 'background: var(--status-expired-bg);   color: var(--status-expired-text)' },
  unclaimed: { label: 'Unclaimed',  style: 'background: var(--status-unclaimed-bg); color: var(--status-unclaimed-text)' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <UModal
    :open="open"
    title="Certificate details"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="cert" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs mb-0.5 detail-label">Recipient name</p>
            <p class="text-sm font-medium detail-value">{{ cert.student_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Recipient email</p>
            <p class="text-sm detail-value">{{ cert.student_email }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Course</p>
            <p class="text-sm font-medium detail-value">{{ cert.course_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Status</p>
            <span
              :style="statusConfig[cert.status]?.style"
              class="text-xs font-medium px-2 py-0.5 rounded-full"
            >
              {{ statusConfig[cert.status]?.label }}
            </span>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Completion date</p>
            <p class="text-sm detail-value">{{ formatDate(cert.completion_date) }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Expiry date</p>
            <p class="text-sm detail-value">
              {{ cert.expiry_date ? formatDate(cert.expiry_date) : 'No expiry' }}
            </p>
          </div>
        </div>

        <div class="pt-4 detail-divider">
          <p class="text-xs mb-0.5 detail-label">Certificate ID</p>
          <p class="text-xs font-mono break-all detail-value">{{ cert.id }}</p>
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
        <UButton color="neutral" variant="outline" @click="emit('update:open', false)">
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.detail-label {
  color: var(--text-tertiary);
}

.detail-value {
  color: var(--text-primary);
}

.detail-divider {
  border-top: 1px solid var(--border);
}
</style>
