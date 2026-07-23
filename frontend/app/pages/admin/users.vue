<script setup lang="ts">
import { formatDate } from '~/composables/useAdminMockData'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { users, deactivateUser } = useAdminMockData()

const search = ref('')
const roleFilter = ref('')

const roleOptions = [
  { value: 'issuer',    label: 'Issuers'    },
  { value: 'recipient', label: 'Recipients' },
]

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value.filter(u => {
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
    if (roleFilter.value && u.role !== roleFilter.value) return false
    return true
  })
})

const columns: Column[] = [
  { key: 'name',             label: 'Name',         sortable: true  },
  { key: 'email',            label: 'Email',        sortable: true, hideMobile: true },
  { key: 'role',             label: 'Role',         sortable: true  },
  { key: 'organizationName', label: 'Organization', sortable: true, hideMobile: true },
  { key: 'status',           label: 'Status',       sortable: true  },
  { key: 'joinedAt',         label: 'Joined',       sortable: true, hideMobile: true },
  { key: '_actions',         label: '',             sortable: false },
]

const deactivateTarget = ref<string | null>(null)

function openDeactivate(userId: string) {
  deactivateTarget.value = userId
}

function confirmDeactivate() {
  if (deactivateTarget.value) deactivateUser(deactivateTarget.value)
  deactivateTarget.value = null
}
</script>

<template>
  <div>
    <AdminPageHeader title="Users" description="All issuers and recipients across every organization." />

    <div class="toolbar">
      <AdminSearchInput v-model="search" placeholder="Search by name or email…" />
      <AdminFilterSelect v-model="roleFilter" :options="roleOptions" placeholder="All roles" />
    </div>

    <AdminTable :columns="columns" :rows="filteredUsers" empty-message="No users match your filters.">
      <template #cell-role="{ value }"><AdminStatusChip :status="value" /></template>
      <template #cell-status="{ value }"><AdminStatusChip :status="value" /></template>
      <template #cell-joinedAt="{ value }">
        <span class="date-cell">{{ formatDate(value) }}</span>
      </template>
      <template #cell-email="{ value }">
        <span class="email-cell">{{ value }}</span>
      </template>
      <template #cell__actions="{ row }">
        <button
          v-if="row.status === 'active'"
          class="action-btn"
          @click.stop="openDeactivate(row.id)"
        >
          Deactivate
        </button>
      </template>
    </AdminTable>

    <AdminConfirmDialog
      :open="!!deactivateTarget"
      title="Deactivate user"
      :message="`This will revoke ${users.find(u => u.id === deactivateTarget)?.name ?? 'this user'}'s access. You can reactivate them later.`"
      confirm-label="Deactivate"
      variant="danger"
      @confirm="confirmDeactivate"
      @cancel="deactivateTarget = null"
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

.date-cell,
.email-cell {
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
