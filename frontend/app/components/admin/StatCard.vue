<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  tint: 'green' | 'blue' | 'amber' | 'violet'
}>()

/*
 * The four `tint` values are kept as the public API so the overview page reads
 * unchanged, but they now select depth along the single brand green rather
 * than four unrelated hues — four different colours for four counts of the
 * same kind of thing was decoration, not information.
 */
const tintMap = {
  green:  'var(--grad-fresh)',
  blue:   'var(--grad-brand)',
  amber:  'var(--grad-deep)',
  violet: 'var(--grad-mist)',
}

const gradient = computed(() => tintMap[props.tint])
</script>

<template>
  <div class="stat-card" :style="{ '--tile-bg': gradient }">
    <div class="stat-wash" aria-hidden="true" />

    <div class="stat-icon-wrap">
      <UIcon :name="icon" class="stat-icon" />
    </div>
    <p class="stat-label">{{ label }}</p>
    <p class="stat-value">{{ value }}</p>
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 20px;
  border-radius: var(--radius-card);
  background: var(--tile-bg);
  color: #fff;
  box-shadow: var(--shadow-tile);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px -14px rgba(10, 92, 82, 0.7);
}

.stat-wash {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(
    140% 100% at 100% 0%,
    rgba(255, 255, 255, 0.22),
    transparent 62%
  );
}

/* A hairline glass chip rather than a filled tile — at 15px the outline glyph
   keeps a ~1px stroke, which is the whole point of the smaller mark. */
.stat-icon-wrap {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.26);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon {
  width: 15px;
  height: 15px;
  color: rgba(255, 255, 255, 0.95);
}

.stat-label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.82);
  margin: 0 0 10px;
  padding-right: 38px;
}

.stat-value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
  margin: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .stat-card:hover { transform: none; }
}
</style>
