<script setup lang="ts">
import { formatDate } from '~/composables/useAdminMockData'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { orgs } = useAdminMockData()

const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')

const typeOptions = [
  { value: 'university',        label: 'University'        },
  { value: 'bootcamp',          label: 'Bootcamp'          },
  { value: 'professional-body', label: 'Professional body' },
  { value: 'event',             label: 'Event'             },
]

const statusOptions = [
  { value: 'active',    label: 'Active'    },
  { value: 'suspended', label: 'Suspended' },
]

const filteredOrgs = computed(() => {
  const q = search.value.trim().toLowerCase()
  return orgs.value.filter(o => {
    if (q && !o.name.toLowerCase().includes(q)) return false
    if (typeFilter.value && o.type !== typeFilter.value) return false
    if (statusFilter.value && o.status !== statusFilter.value) return false
    return true
  })
})

const columns: Column[] = [
  { key: 'name',             label: 'Organization',   sortable: true  },
  { key: 'type',             label: 'Type',           sortable: true  },
  { key: 'issuersCount',     label: 'Issuers',        sortable: true, hideMobile: true },
  { key: 'certificatesCount',label: 'Certificates',   sortable: true, hideMobile: true },
  { key: 'status',           label: 'Status',         sortable: true  },
  { key: 'createdAt',        label: 'Created',        sortable: true, hideMobile: true },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Organizations" description="All institutions and organizations registered on the platform." />

    <div class="toolbar">
      <AdminSearchInput v-model="search" placeholder="Search organizations…" />
      <div class="filters">
        <AdminFilterSelect v-model="typeFilter"   :options="typeOptions"   placeholder="All types"    />
        <AdminFilterSelect v-model="statusFilter" :options="statusOptions" placeholder="All statuses" />
      </div>
    </div>

    <AdminTable
      :columns="columns"
      :rows="filteredOrgs"
      empty-message="No organizations match your filters."
      clickable
      @row-click="navigateTo(`/admin/organizations/${$event.id}`)"
    >
      <template #cell-type="{ value }">
        <AdminStatusChip :status="value" />
      </template>
      <template #cell-status="{ value }">
        <AdminStatusChip :status="value" />
      </template>
      <template #cell-createdAt="{ value }">
        <span class="date-cell">{{ formatDate(value) }}</span>
      </template>
    </AdminTable>
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
</style>
