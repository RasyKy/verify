<script setup lang="ts">
/**
 * A single icon action inside a table row.
 *
 * `label` is not decorative: it is both the tooltip and the accessible name, so
 * an icon-only control still announces what it does. Icons stay neutral at rest
 * and take their intent colour on hover — a row of permanently red glyphs read
 * as a row of warnings.
 */
withDefaults(
  defineProps<{
    icon: string
    label: string
    danger?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  { danger: false, disabled: false, loading: false },
)

const emit = defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <UTooltip :text="label">
    <button
      type="button"
      class="row-action"
      :class="{ 'row-action--danger': danger }"
      :disabled="disabled || loading"
      :aria-label="label"
      @click.stop="emit('click', $event)"
    >
      <UIcon
        :name="loading ? 'i-heroicons-arrow-path' : icon"
        class="row-action-icon"
        :class="{ 'row-action-icon--spin': loading }"
      />
    </button>
  </UTooltip>
</template>

<style scoped>
.row-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast);
}

.row-action:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-light);
}

.row-action--danger:hover:not(:disabled) {
  color: var(--status-revoked-text);
  background: var(--status-revoked-bg);
}

.row-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.row-action:disabled {
  color: var(--text-tertiary);
  opacity: 0.5;
  cursor: default;
}

.row-action-icon {
  width: 16px;
  height: 16px;
}

.row-action-icon--spin {
  animation: row-action-spin 0.7s linear infinite;
}

@keyframes row-action-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .row-action-icon--spin { animation: none; }
}
</style>
