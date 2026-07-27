<script setup lang="ts">
import { formatDate } from '~/composables/useAdminMockData'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { certs, orgs, revokeCert } = useAdminMockData()

const search = ref('')
const orgFilter = ref('')
const statusFilter = ref('')

const orgOptions = computed(() =>
  orgs.value.map(o => ({ value: o.id, label: o.name }))
)

const statusOptions = [
  { value: 'issued',  label: 'Issued'  },
  { value: 'revoked', label: 'Revoked' },
]

const filteredCerts = computed(() => {
  const q = search.value.trim().toLowerCase()
  return certs.value.filter(c => {
    if (q && !c.recipientName.toLowerCase().includes(q) && !c.courseName.toLowerCase().includes(q)) return false
    if (orgFilter.value && c.organizationId !== orgFilter.value) return false
    if (statusFilter.value && c.status !== statusFilter.value) return false
    return true
  })
})

const columns: Column[] = [
  { key: 'recipientName',   label: 'Recipient',     sortable: true  },
  { key: 'courseName',      label: 'Course',        sortable: true  },
  { key: 'organizationName',label: 'Organization',  sortable: true, hideMobile: true },
  { key: 'issuedAt',        label: 'Issued',        sortable: true, hideMobile: true },
  { key: 'status',          label: 'Status',        sortable: true  },
  { key: '_actions',        label: '',              sortable: false  },
]

const revokeTarget = ref<string | null>(null)
const revokeTargetName = computed(() => {
  const c = certs.value.find(c => c.id === revokeTarget.value)
  return c ? `${c.courseName} — ${c.recipientName}` : ''
})

function confirmRevoke() {
  if (revokeTarget.value) revokeCert(revokeTarget.value)
  revokeTarget.value = null
}
</script>

<template>
  <div>
    <AdminPageHeader title="Certificates" description="All certificates issued across the platform." />

    <div class="toolbar">
      <AdminSearchInput v-model="search" placeholder="Search by recipient or course…" />
      <div class="filters">
        <AdminFilterSelect v-model="orgFilter"    :options="orgOptions"    placeholder="All organizations" />
        <AdminFilterSelect v-model="statusFilter" :options="statusOptions" placeholder="All statuses"      />
      </div>
    </div>

    <AdminTable :columns="columns" :rows="filteredCerts" empty-message="No certificates match your filters.">
      <template #cell-issuedAt="{ value }">
        <span class="date-cell">{{ formatDate(value) }}</span>
      </template>
      <template #cell-status="{ value }"><AdminStatusChip :status="value" /></template>
      <template #cell__actions="{ row }">
        <button
          v-if="row.status === 'issued'"
          class="action-btn"
          @click.stop="revokeTarget = row.id"
        >
          Revoke
        </button>
      </template>
    </AdminTable>

    <AdminConfirmDialog
      :open="!!revokeTarget"
      title="Revoke certificate"
      :message="`Revoke &quot;${revokeTargetName}&quot;? This cannot be undone via this UI.`"
      confirm-label="Revoke"
      variant="danger"
      @confirm="confirmRevoke"
      @cancel="revokeTarget = null"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.date-cell {
  color: var(--text-secondary);
  font-size: 13px;
}

.action-btn {
  font-size: 12px;
  font-weight: 500;
  color: var(--status-revoked-text);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.action-btn:hover {
  opacity: 0.7;
}
</style>
