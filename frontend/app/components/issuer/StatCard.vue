<script setup lang="ts">
/**
 * Filled gradient tile. The number is the loudest thing on the dashboard, so
 * it carries the surface colour rather than sitting on white next to a small
 * tinted icon chip.
 *
 * `color` stays the old four-value API — the pages calling this don't change —
 * but the values now map onto gradients from the brand ramp, with red/amber
 * reserved for states that should read as "not fine".
 */
const props = defineProps<{
  label: string
  value: number | undefined | null
  icon: string
  color: 'teal' | 'red' | 'gray' | 'amber'
  /** Optional line under the number, e.g. "across 4 courses". */
  hint?: string
}>()

const gradientFor: Record<typeof props.color, string> = {
  teal:  'var(--grad-fresh)',
  red:   'var(--grad-alert)',
  gray:  'var(--grad-slate)',
  amber: 'var(--grad-amber)',
}

const gradient = computed(() => gradientFor[props.color])
</script>

<template>
  <div class="stat-tile" :style="{ '--tile-bg': gradient }">
    <!-- Decorative wash + oversized watermark icon, both purely visual -->
    <div class="tile-wash" aria-hidden="true" />
    <UIcon :name="icon" class="tile-watermark" aria-hidden="true" />

    <div class="tile-head">
      <span class="tile-label">{{ label }}</span>
      <span class="tile-icon-chip">
        <UIcon :name="icon" class="tile-icon" />
      </span>
    </div>

    <p v-if="value !== null && value !== undefined" class="tile-value">
      {{ value.toLocaleString() }}
    </p>
    <div v-else class="tile-skeleton" />

    <p v-if="hint" class="tile-hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.stat-tile {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 18px 20px 20px;
  border-radius: var(--radius-card);
  background: var(--tile-bg);
  color: #fff;
  box-shadow: var(--shadow-tile);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.tile-wash {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(
    140% 100% at 100% 0%,
    rgba(255, 255, 255, 0.22),
    transparent 62%
  );
}

.tile-watermark {
  position: absolute;
  right: -14px;
  bottom: -18px;
  width: 92px;
  height: 92px;
  z-index: -1;
  opacity: 0.14;
  pointer-events: none;
}

.stat-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px -14px rgba(10, 92, 82, 0.7);
}

.tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tile-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.82);
}

.tile-icon-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.18);
}

.tile-icon {
  width: 16px;
  height: 16px;
}

.tile-value {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 12px 0 0;
  font-variant-numeric: tabular-nums;
}

.tile-hint {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.75);
  margin: 4px 0 0;
}

.tile-skeleton {
  height: 34px;
  width: 64px;
  margin-top: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.25);
  animation: tilePulse 1.4s ease-in-out infinite;
}

@keyframes tilePulse {
  0%, 100% { opacity: 0.45; }
  50%      { opacity: 0.8; }
}

@media (prefers-reduced-motion: reduce) {
  .stat-tile:hover { transform: none; }
  .tile-skeleton { animation: none; }
}
</style>
