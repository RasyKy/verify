<script setup lang="ts">
definePageMeta({ layout: 'issuer' })

const { stats, chartData: getChartData, recentActivity } = useIssuerMockData()

const range = ref('30d')

const rangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
]

const rangeDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
const chartData = computed(() => getChartData(rangeDays[range.value] ?? 30))
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-xl font-medium text-gray-900">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-500">Overview of your certificate activity.</p>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <IssuerStatCard
        label="Total issued"
        :value="stats.total"
        icon="i-heroicons-document-text"
        color="gray"
      />
      <IssuerStatCard
        label="Valid"
        :value="stats.valid"
        icon="i-heroicons-check-circle"
        color="teal"
      />
      <IssuerStatCard
        label="Revoked"
        :value="stats.revoked"
        icon="i-heroicons-x-circle"
        color="red"
      />
      <IssuerStatCard
        label="Expired"
        :value="stats.expired"
        icon="i-heroicons-clock"
        color="gray"
      />
    </div>

    <!-- Chart card -->
    <div class="bg-white border border-gray-200 rounded-lg p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-gray-900">Certificates issued</h2>
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
    <div class="bg-white border border-gray-200 rounded-lg p-5">
      <h2 class="text-sm font-medium text-gray-900 mb-4">Recent activity</h2>
      <IssuerRecentActivity
        :activities="recentActivity"
        :loading="false"
      />
    </div>
  </div>
</template>
