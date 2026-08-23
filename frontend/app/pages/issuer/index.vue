<script setup lang="ts">
definePageMeta({ layout: 'issuer' })

const range = ref('30d')

const rangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
]

// Same useState key the issuer layout owns, so the header button and the rail
// button open the one modal instance the layout renders.
const issueModalOpen = useState<boolean>('issue-modal', () => false)

// Refetches on range change — the chart series is zero-filled server-side for
// exactly the requested window, so it cannot be derived by slicing a cache.
const { data: dashboard, pending } = useDashboard(range)

const stats = computed(() => dashboard.value.stats)
const chartData = computed(() => dashboard.value.chartData)
const recentActivity = computed(() => dashboard.value.recentActivity)
</script>

<template>
  <div class="dash">
    <!-- Header -->
    <header class="dash-header">
      <div>
        <p class="dash-eyebrow">Issuer portal</p>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-subtitle">
          Everything your institution has issued, at a glance.
        </p>
      </div>
      <button class="dash-action" @click="issueModalOpen = true">
        <UIcon name="i-heroicons-plus" class="dash-action-icon" />
        Issue certificate
      </button>
    </header>

    <!-- Stat tiles -->
    <div class="tile-grid">
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
        color="amber"
      />
    </div>

    <!-- Chart + activity, side by side on wide screens -->
    <div class="panel-grid">
      <section class="panel card-in" style="--i: 4">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Certificates issued</h2>
            <p class="panel-sub">Issuance volume over the selected window.</p>
          </div>
          <USelect
            v-model="range"
            :items="rangeOptions"
            value-key="value"
            label-key="label"
            class="w-36"
          />
        </div>
        <IssuerIssuanceChart :data="chartData" :loading="pending" />
      </section>

      <section class="panel card-in" style="--i: 5">
        <div class="panel-head">
          <div>
            <h2 class="panel-title">Recent activity</h2>
            <p class="panel-sub">The latest issuances and revocations.</p>
          </div>
        </div>
        <IssuerRecentActivity :activities="recentActivity" :loading="pending" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ── Header ── */
.dash-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.dash-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 6px;
}

.dash-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  margin: 0;
}

.dash-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 5px 0 0;
}

.dash-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: var(--grad-brand);
  box-shadow: var(--shadow-tile);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.dash-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -12px rgba(10, 92, 82, 0.7);
}

.dash-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.dash-action-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Grids ── */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.panel-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

/* ── Panels ── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-panel);
  padding: 20px 22px 22px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  margin: 0;
}

.panel-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 3px 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .dash-action:hover { transform: none; }
}

@media (max-width: 1180px) {
  .panel-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .tile-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-action {
    width: 100%;
    justify-content: center;
  }
}
</style>
