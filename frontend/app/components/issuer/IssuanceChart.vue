<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{
  data: Array<{ date: string; count: number }>
  loading: boolean
}>()

const chartData = computed(() => ({
  labels: props.data.map((d) =>
    new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  ),
  datasets: [
    {
      data: props.data.map((d) => d.count),
      borderColor: 'rgb(13, 148, 136)',
      backgroundColor: 'rgba(13, 148, 136, 0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: 'rgb(13, 148, 136)',
      borderWidth: 2,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) =>
          ` ${ctx.parsed.y} certificate${ctx.parsed.y !== 1 ? 's' : ''}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: '#9CA3AF', font: { size: 11 } },
    },
    y: {
      grid: { color: '#F3F4F6' },
      border: { display: false },
      ticks: { color: '#9CA3AF', font: { size: 11 }, stepSize: 1 },
      beginAtZero: true,
    },
  },
}
</script>

<template>
  <div class="h-52">
    <div v-if="loading" class="h-full w-full bg-gray-100 rounded animate-pulse" />
    <div v-else-if="data.length === 0" class="h-full flex items-center justify-center">
      <p class="text-sm text-gray-400">No certificates issued in this period.</p>
    </div>
    <ClientOnly v-else>
      <Line :data="chartData" :options="chartOptions" style="height: 100%" />
    </ClientOnly>
  </div>
</template>
