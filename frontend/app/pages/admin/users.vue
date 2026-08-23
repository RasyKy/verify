<script setup lang="ts">
import { formatDate, setUserStatus, deleteUser } from '~/composables/useAdmin'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { users, refresh } = useAdminUsers()

const inviteOpen = ref(false)

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

const toast = useToast()

const deleteTarget = ref<string | null>(null)
const deleteTargetName = computed(
  () => users.value.find(u => u.id === deleteTarget.value)?.name ?? 'this user',
)

async function confirmDelete() {
  const id = deleteTarget.value
  deleteTarget.value = null
  if (!id) return
  try {
    await deleteUser(id)
    toast.add({ title: 'Account deleted', color: 'success' })
  } catch (err: unknown) {
    toast.add({
      title: 'Could not delete this account',
      description:
        (err as { data?: { message?: string } })?.data?.message ??
        'Nothing was removed. Please try again.',
      color: 'error',
    })
  }
  await refresh()
}

async function reactivate(id: string) {
  await setUserStatus(id, 'active')
  await refresh()
}

async function confirmDeactivate() {
  const id = deactivateTarget.value
  deactivateTarget.value = null
  if (!id) return
  await setUserStatus(id, 'deactivated')
  // Refetch rather than patching the row locally: the write may have been
  // refused, and a list that disagrees with the server is worse than a
  // half-second wait.
  await refresh()
}
</script>

<template>
  <div>
    <AdminInviteIssuerModal v-model:open="inviteOpen" @invited="refresh()" />

    <AdminPageHeader
      eyebrow="Admin portal"
      title="Users"
      description="All issuers and recipients across every organization."
    >
      <template #actions>
        <UButton color="primary" icon="i-heroicons-user-plus" @click="inviteOpen = true">
          Invite issuer
        </UButton>
      </template>
    </AdminPageHeader>

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
        <div class="row-actions">
          <button
            v-if="row.status === 'active'"
            class="action-btn"
            @click.stop="openDeactivate(row.id)"
          >
            Deactivate
          </button>
          <button
            v-else
            class="action-btn"
            @click.stop="reactivate(row.id)"
          >
            Reactivate
          </button>
          <button class="action-btn action-btn--danger" @click.stop="deleteTarget = row.id">
            Delete
          </button>
        </div>
      </template>
    </AdminTable>

    <!--


      Deactivation is reversible and keeps the account attributable. Deletion


      is neither, so the copy names what survives and what does not.


    -->


    <AdminConfirmDialog


      :open="!!deleteTarget"


      title="Delete account permanently"


      :message="`Remove ${deleteTargetName} and their sign-in entirely. Certificates they issued stay valid, and the audit log keeps their name — but the account cannot be restored. Deactivate instead if you may want them back.`"


      confirm-label="Delete permanently"


      variant="danger"


      @confirm="confirmDelete"


      @cancel="deleteTarget = null"


    />


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
.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.action-btn--danger {
  color: var(--status-revoked-text);
}

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
