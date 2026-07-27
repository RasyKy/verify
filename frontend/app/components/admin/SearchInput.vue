<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>()
defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <div class="search-wrap">
    <UIcon name="i-heroicons-magnifying-glass" class="search-icon" />
    <input
      :value="modelValue"
      type="text"
      class="search-input"
      :placeholder="placeholder ?? 'Search…'"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.search-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 15px;
  height: 15px;
  color: var(--text-tertiary);
  pointer-events: none;
  flex-shrink: 0;
}

.search-input {
  padding: 8px 12px 8px 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--surface);
  outline: none;
  min-width: 220px;
  transition: border-color 0.15s ease;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-light);
}
</style>
