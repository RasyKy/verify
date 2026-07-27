<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number | undefined | null
  icon: string
  color: 'teal' | 'red' | 'gray' | 'amber'
}>()

// Teal classes resolve to our dark-green via the --color-teal-* token overrides.
const colorMap = {
  teal:  { bg: 'bg-teal-50',  text: 'text-teal-600' },
  red:   { bg: 'bg-red-50',   text: 'text-red-600' },
  gray:  { bg: 'bg-gray-100', text: 'text-gray-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
}

const colors = computed(() => colorMap[props.color])
</script>

<template>
  <div class="relative border rounded-lg p-5 stat-card">
    <div :class="['absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center', colors.bg]">
      <UIcon :name="icon" :class="['size-4', colors.text]" />
    </div>
    <p class="text-sm stat-label">{{ label }}</p>
    <p v-if="value !== null && value !== undefined" class="text-2xl font-semibold mt-1 stat-value">
      {{ value }}
    </p>
    <div v-else class="mt-2 h-7 w-12 bg-gray-200 rounded animate-pulse" />
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--surface);
  border-color: var(--border);
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  color: var(--text-primary);
}
</style>
