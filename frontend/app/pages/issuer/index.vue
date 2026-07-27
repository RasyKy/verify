<script setup lang="ts">
definePageMeta({ layout: 'issuer' })

interface DashboardData {
  stats: { total: number; valid: number; revoked: number; expired: number }
  chartData: Array<{ date: string; count: number }>
  recentActivity: Array<{
    type: 'issued' | 'revoked' | 'claimed'
    studentName: string
    courseName?: string
    timestamp: string
  }>
}

const { data: dashboard, pending } = useFetch<DashboardData>('/api/dashboard?range=30d', {
  default: () => null,
})

const range = ref('30d')
const chartData = ref<Array<{ date: string; count: number }>>([])
const chartPending = ref(false)

const rangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
]

watch(dashboard, (d) => {
  if (d) chartData.value = d.chartData ?? []
}, { immediate: true })

watch(range, async (r) => {
  chartPending.value = true
  try {
    const res = await $fetch<DashboardData>(`/api/dashboard?range=${r}`)
    chartData.value = res.chartData ?? []
  } catch {
    // silently fail — main error surfaced by initial dashboard fetch
  } finally {
    chartPending.value = false
  }
})
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
        :value="dashboard?.stats.total"
        icon="i-heroicons-document-text"
        color="gray"
      />
      <IssuerStatCard
        label="Valid"
        :value="dashboard?.stats.valid"
        icon="i-heroicons-check-circle"
        color="teal"
      />
      <IssuerStatCard
        label="Revoked"
        :value="dashboard?.stats.revoked"
        icon="i-heroicons-x-circle"
        color="red"
      />
      <IssuerStatCard
        label="Expired"
        :value="dashboard?.stats.expired"
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
      <IssuerIssuanceChart :data="chartData" :loading="pending || chartPending" />
    </div>

    <!-- Activity card -->
    <div class="bg-white border border-gray-200 rounded-lg p-5">
      <h2 class="text-sm font-medium text-gray-900 mb-4">Recent activity</h2>
      <IssuerRecentActivity
        :activities="dashboard?.recentActivity ?? []"
        :loading="pending"
      />
    </div>
  </div>
</template>
