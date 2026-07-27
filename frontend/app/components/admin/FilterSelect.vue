<script setup lang="ts">
defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  placeholder?: string
}>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <div class="select-wrap">
    <select
      :value="modelValue"
      class="filter-select"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ placeholder ?? 'All' }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <UIcon name="i-heroicons-chevron-down" class="select-caret" />
  </div>
</template>

<style scoped>
.select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.filter-select {
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--surface);
  outline: none;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
  min-width: 140px;
}

.filter-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.select-caret {
  position: absolute;
  right: 8px;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  pointer-events: none;
}
</style>
