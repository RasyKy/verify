<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  tint: 'green' | 'blue' | 'amber' | 'violet'
}>()

const tintMap = {
  green:  { bg: 'var(--tint-green)',  icon: 'var(--tint-green-icon)'  },
  blue:   { bg: 'var(--tint-blue)',   icon: 'var(--tint-blue-icon)'   },
  amber:  { bg: 'var(--tint-amber)',  icon: 'var(--tint-amber-icon)'  },
  violet: { bg: 'var(--tint-violet)', icon: 'var(--tint-violet-icon)' },
}

const t = computed(() => tintMap[props.tint])
</script>

<template>
  <div class="stat-card">
    <div class="stat-icon-wrap" :style="`background: ${t.bg}`">
      <UIcon :name="icon" class="stat-icon" :style="`color: ${t.icon}`" />
    </div>
    <p class="stat-label">{{ label }}</p>
    <p class="stat-value">{{ value }}</p>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  position: relative;
}

.stat-icon-wrap {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon {
  width: 16px;
  height: 16px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1;
}
</style>
