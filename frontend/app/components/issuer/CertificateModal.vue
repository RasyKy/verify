<script setup lang="ts">
defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()
</script>

<template>
  <UModal
    :open="open"
    title="Issue certificate"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <IssuerCertificateForm
        @success="emit('update:open', false); emit('success')"
        @cancel="emit('update:open', false)"
      />
    </template>
  </UModal>
</template>
