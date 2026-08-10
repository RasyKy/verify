<script setup lang="ts">
interface Certificate {
  id: string
  student_name: string
  course_name: string
}

const props = defineProps<{
  open: boolean
  cert: Certificate | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  revoked: [certId: string]
}>()

const toast = useToast()
const isLoading = ref(false)
const { revokeCertificate } = useIssuerMockData()

function onConfirm() {
  if (!props.cert) return
  isLoading.value = true
  revokeCertificate(props.cert.id)
  toast.add({ title: 'Certificate revoked', color: 'success' })
  emit('revoked', props.cert.id)
  emit('update:open', false)
  isLoading.value = false
}
</script>

<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-red-50 shrink-0">
          <UIcon name="i-heroicons-exclamation-triangle" class="size-5 text-red-600" />
        </div>
        <div>
          <h3 class="text-base font-semibold revoke-title">Revoke this certificate?</h3>
          <p class="text-sm mt-0.5 revoke-subtitle">This action cannot be undone.</p>
        </div>
      </div>
    </template>

    <template #body>
      <p class="text-sm revoke-body">
        This will permanently mark the certificate as revoked on the blockchain. This action cannot be
        undone.
      </p>
      <div v-if="cert" class="mt-4 p-3 rounded-lg space-y-1 revoke-info-box">
        <p class="text-xs revoke-info-label">Revoking certificate for</p>
        <p class="text-sm font-medium revoke-title">{{ cert.student_name }}</p>
        <p class="text-sm revoke-subtitle">{{ cert.course_name }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="isLoading"
          @click="emit('update:open', false)"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          :loading="isLoading"
          icon="i-heroicons-no-symbol"
          @click="onConfirm"
        >
          Revoke certificate
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.revoke-title {
  color: var(--text-primary);
}

.revoke-subtitle {
  color: var(--text-secondary);
}

.revoke-body {
  color: var(--text-primary);
}

.revoke-info-box {
  background: var(--surface-hover);
  border: 1px solid var(--border);
}

.revoke-info-label {
  color: var(--text-tertiary);
}
</style>
