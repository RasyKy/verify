<script setup lang="ts">
defineProps<{
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  submit: []
}>()
</script>

<template>
  <div class="flex gap-2">
    <UInput
      :model-value="modelValue"
      icon="i-heroicons-magnifying-glass"
      placeholder="Enter certificate ID..."
      class="flex-1 bg-white"
      :disabled="loading"
      @update:model-value="emit('update:modelValue', String($event))"
      @keyup.enter="emit('submit')"
    />
    <UButton color="primary" :loading="loading" @click="emit('submit')">
      Verify
    </UButton>
  </div>
</template>
