<script setup lang="ts">
import { actionMeta, actionLabel, timeAgo } from '~/composables/useAdmin'

definePageMeta({ layout: 'admin' })

const { data: stats } = useAdminStats()
const { auditEvents } = useAdminAudit()

const totalOrgs = computed(() => stats.value.totalOrgs)
const totalCerts = computed(() => stats.value.totalCerts)
const activeIssuers = computed(() => stats.value.activeIssuers)
const verificationsLast30 = computed(() => stats.value.verificationsLast30)
const monthlyCerts = computed(() => stats.value.monthlyCerts)

const recentActivity = computed(() => auditEvents.value.slice(0, 8))

const tintStyle = (tint: string) => {
  const map: Record<string, { bg: string; icon: string }> = {
    green:  { bg: 'var(--tint-green)',            icon: 'var(--tint-green-icon)'  },
    blue:   { bg: 'var(--tint-blue)',             icon: 'var(--tint-blue-icon)'   },
    amber:  { bg: 'var(--tint-amber)',            icon: 'var(--tint-amber-icon)'  },
    red:    { bg: 'var(--status-revoked-bg)',     icon: 'var(--status-revoked-text)' },
  }
  return map[tint] ?? map.green
}
</script>

<template>
  <div>
    <AdminPageHeader
      eyebrow="Admin portal"
      title="Overview"
      description="Platform-wide snapshot across all organizations."
    />

    <!-- Stat cards -->
    <div class="stats-grid">
      <AdminStatCard class="card-in" style="--i: 0" label="Total organizations"   :value="totalOrgs"           icon="i-heroicons-building-office-2" tint="green"  />
      <AdminStatCard class="card-in" style="--i: 1" label="Total certificates"    :value="totalCerts"          icon="i-heroicons-document-text"     tint="blue"   />
      <AdminStatCard class="card-in" style="--i: 2" label="Active issuers"        :value="activeIssuers"       icon="i-heroicons-users"             tint="amber"  />
      <AdminStatCard class="card-in" style="--i: 3" label="Verifications (30d)"   :value="verificationsLast30" icon="i-heroicons-magnifying-glass"  tint="violet" />
    </div>

    <!-- Chart + Activity -->
    <div class="lower-grid">
      <div class="card">
        <h2 class="card-title">Certificates issued per month</h2>
        <AdminMiniBarChart :data="monthlyCerts" :max-height="120" />
      </div>

      <div class="card">
        <h2 class="card-title">Recent activity</h2>
        <ul v-if="recentActivity.length" class="activity-list">
          <li v-for="event in recentActivity" :key="event.id" class="activity-item">
            <div
              class="activity-icon"
              :style="`background: ${tintStyle(actionMeta(event.action).tint).bg}`"
            >
              <UIcon
                :name="actionMeta(event.action).icon"
                class="size-3.5"
                :style="`color: ${tintStyle(actionMeta(event.action).tint).icon}`"
              />
            </div>
            <div class="activity-body">
              <span class="activity-actor">{{ event.actorName }}</span>
              <span class="activity-action"> · {{ actionLabel(event.action) }}</span>
              <p class="activity-target">{{ event.targetLabel }}</p>
            </div>
            <span class="activity-time">{{ timeAgo(event.timestamp) }}</span>
          </li>
        </ul>
        <div v-else class="empty-state">
          <UIcon name="i-heroicons-clock" class="empty-icon" />
          <p>No activity recorded yet. Actions across the platform will show up here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.lower-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 20px;
  background: var(--surface);
  box-shadow: var(--shadow-panel);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--text-tertiary);
  text-align: center;
}

.empty-icon {
  width: 28px;
  height: 28px;
}

.empty-state p {
  font-size: 12px;
  margin: 0;
  max-width: 220px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 20px;
}

/* Activity list */
.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.activity-body {
  flex: 1;
  min-width: 0;
}

.activity-actor {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.activity-action {
  font-size: 12px;
  color: var(--text-secondary);
}

.activity-target {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-time {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
