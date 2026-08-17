<script setup lang="ts">
definePageMeta({ layout: 'issuer' })

const range = ref('30d')

const rangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
]

// Refetches on range change — the chart series is zero-filled server-side for
// exactly the requested window, so it cannot be derived by slicing a cache.
const { data: dashboard } = useDashboard(range)

const stats = computed(() => dashboard.value.stats)
const chartData = computed(() => dashboard.value.chartData)
const recentActivity = computed(() => dashboard.value.recentActivity)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold page-title">Dashboard</h1>
      <p class="mt-1 text-sm page-subtitle">Overview of your certificate activity.</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <IssuerStatCard
        class="card-in"
        style="--i: 0"
        label="Total issued"
        :value="stats.total"
        icon="i-heroicons-document-text"
        color="gray"
      />
      <IssuerStatCard
        class="card-in"
        style="--i: 1"
        label="Valid"
        :value="stats.valid"
        icon="i-heroicons-check-circle"
        color="teal"
      />
      <IssuerStatCard
        class="card-in"
        style="--i: 2"
        label="Revoked"
        :value="stats.revoked"
        icon="i-heroicons-x-circle"
        color="red"
      />
      <IssuerStatCard
        class="card-in"
        style="--i: 3"
        label="Expired"
        :value="stats.expired"
        icon="i-heroicons-clock"
        color="gray"
      />
    </div>

    <!-- Chart card -->
    <div class="panel-card rounded-lg p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold page-title">Certificates issued</h2>
        <USelect
          v-model="range"
          :items="rangeOptions"
          value-key="value"
          label-key="label"
          class="w-36"
        />
      </div>
      <IssuerIssuanceChart :data="chartData" :loading="false" />
    </div>

    <!-- Activity card -->
    <div class="panel-card rounded-lg p-5">
      <h2 class="text-sm font-semibold page-title mb-4">Recent activity</h2>
      <IssuerRecentActivity
        :activities="recentActivity"
        :loading="false"
      />
    </div>
  </div>
</template>

<style scoped>
.page-title {
  color: var(--text-primary);
}

.page-subtitle {
  color: var(--text-secondary);
}

.panel-card {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}
</style>
