<script setup lang="ts">
const props = defineProps<{
  data: { month: string; count: number }[]
  maxHeight?: number
}>()

const h = computed(() => props.maxHeight ?? 120)
const peak = computed(() => Math.max(...props.data.map(d => d.count), 1))
</script>

<template>
  <div class="chart">
    <div class="bars">
      <div v-for="d in data" :key="d.month" class="bar-col">
        <div class="bar-track">
          <div
            class="bar"
            :style="`height: ${Math.round((d.count / peak) * h)}px`"
            :title="`${d.month}: ${d.count}`"
          />
        </div>
        <span class="bar-label">{{ d.month }}</span>
        <span class="bar-val">{{ d.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  width: 100%;
}

.bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bar-track {
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 100%;
  max-width: 40px;
  background: var(--accent);
  opacity: 0.65;
  border-radius: 4px 4px 0 0;
  transition: opacity 0.15s ease;
  min-height: 4px;
}

.bar:hover {
  opacity: 1;
}

.bar-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
}

.bar-val {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}
</style>
