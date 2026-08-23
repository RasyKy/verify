<script setup lang="ts">
import { formatDate } from '~/composables/useAdmin'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { orgs, refresh } = useAdminOrgs()

const createOpen = ref(false)

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
    <AdminOrgFormModal v-model:open="createOpen" @created="refresh()" />

    <AdminPageHeader
      eyebrow="Admin portal"
      title="Organizations"
      description="All institutions and organizations registered on the platform."
    >
      <template #actions>
        <UButton color="primary" icon="i-heroicons-plus" @click="createOpen = true">
          Add institution
        </UButton>
      </template>
    </AdminPageHeader>

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
      <template #cell-name="{ row }">
        <div class="org-cell">
          <img v-if="row.logoUrl" :src="row.logoUrl" :alt="''" class="org-mark" loading="lazy" />
          <span v-else class="org-mark org-mark--empty">{{ (row.name?.[0] ?? '?').toUpperCase() }}</span>
          <span class="org-name">{{ row.name }}</span>
        </div>
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
.org-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.org-mark {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 6px;
}

.org-mark--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-light);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
}

.org-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

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
