<script setup lang="ts">
import { ACTION_LABELS, type AuditAction } from '~/composables/useAdminMockData'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { auditEvents } = useAdminMockData()

const actionFilter = ref('')

const actionOptions = (Object.keys(ACTION_LABELS) as AuditAction[]).map(k => ({
  value: k,
  label: ACTION_LABELS[k],
}))

const filteredEvents = computed(() => {
  if (!actionFilter.value) return auditEvents.value
  return auditEvents.value.filter(e => e.action === actionFilter.value)
})

const tableRows = computed(() =>
  filteredEvents.value.map(e => ({
    ...e,
    _timestamp: new Date(e.timestamp).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    _action: ACTION_LABELS[e.action],
  }))
)

const columns: Column[] = [
  { key: '_timestamp',     label: 'Timestamp',    sortable: true  },
  { key: 'actorName',      label: 'Actor',        sortable: true  },
  { key: '_action',        label: 'Action',       sortable: true  },
  { key: 'targetLabel',    label: 'Target',       sortable: false, hideMobile: true },
  { key: 'organizationName', label: 'Organization', sortable: true, hideMobile: true },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Audit log" description="A chronological record of all platform actions." />

    <div class="toolbar">
      <AdminFilterSelect v-model="actionFilter" :options="actionOptions" placeholder="All actions" />
    </div>

    <AdminTable :columns="columns" :rows="tableRows" empty-message="No audit events match the selected filter.">
      <template #cell__timestamp="{ value }">
        <span class="timestamp-cell">{{ value }}</span>
      </template>
      <template #cell__action="{ value }">
        <span class="action-cell">{{ value }}</span>
      </template>
    </AdminTable>
  </div>
</template>

<style scoped>
.toolbar {
  margin-bottom: 16px;
}

.timestamp-cell {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.action-cell {
  font-size: 13px;
  color: var(--text-primary);
}
</style>
