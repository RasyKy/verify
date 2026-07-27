<script setup lang="ts">
interface Activity {
  type: 'issued' | 'revoked' | 'claimed'
  studentName: string
  courseName?: string
  timestamp: string
}

defineProps<{
  activities: Activity[]
  loading: boolean
}>()

const activityConfig = {
  issued: { icon: 'i-heroicons-document-plus', class: 'bg-teal-50 text-teal-600' },
  revoked: { icon: 'i-heroicons-x-circle', class: 'bg-red-50 text-red-600' },
  claimed: { icon: 'i-heroicons-user-check', class: 'bg-amber-50 text-amber-600' },
}

function activityLabel(a: Activity) {
  if (a.type === 'issued') return `Certificate issued to ${a.studentName} for ${a.courseName}`
  if (a.type === 'revoked') return `Certificate revoked for ${a.studentName}`
  return `${a.studentName} claimed their certificate`
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="space-y-1 py-1">
    <div v-for="i in 5" :key="i" class="flex items-center gap-3 py-2">
      <div class="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
        <div class="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
      </div>
    </div>
  </div>

  <!-- Empty state -->
  <div v-else-if="activities.length === 0" class="py-12 flex items-center justify-center">
    <p class="text-sm text-gray-400">No recent activity yet.</p>
  </div>

  <!-- Activity list -->
  <ul v-else class="divide-y divide-gray-100">
    <li v-for="(activity, i) in activities" :key="i" class="flex items-start gap-3 py-3">
      <div
        :class="[
          'w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
          activityConfig[activity.type].class,
        ]"
      >
        <UIcon :name="activityConfig[activity.type].icon" class="size-4" />
      </div>
      <p class="text-sm text-gray-700 flex-1 pt-1.5">{{ activityLabel(activity) }}</p>
      <span class="text-xs text-gray-400 shrink-0 pt-1.5">{{ timeAgo(activity.timestamp) }}</span>
    </li>
  </ul>
</template>
