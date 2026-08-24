<script setup lang="ts">
import { apiErrorMessage } from '~/composables/useCertificates'
import {
  formatDate,
  revokeCertificateAsAdmin,
  deleteCertificate,
  resendClaimEmailAsAdmin,
  type AdminCert,
} from '~/composables/useAdmin'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const { certs, refresh } = useAdminCerts()
const { orgs } = useAdminOrgs()

// Issue / correct. One modal instance serves both: `formTarget` null means
// "new", a row means "correct that one".
const formOpen = ref(false)
const formTarget = ref<AdminCert | null>(null)

function openIssue() {
  formTarget.value = null
  formOpen.value = true
}

function openEdit(cert: AdminCert) {
  formTarget.value = cert
  formOpen.value = true
}

// Only meaningful while a certificate is unclaimed and unrevoked; the backend
// refuses the rest with a message the toast surfaces.
const { resendClaim, resendingId } = useClaimResend(resendClaimEmailAsAdmin)

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

const toast = useToast()

const deleteTarget = ref<string | null>(null)
const deleteTargetName = computed(() => {
  const c = certs.value.find(c => c.id === deleteTarget.value)
  return c ? `${c.courseName} — ${c.recipientName}` : ''
})

async function confirmDelete() {
  const id = deleteTarget.value
  deleteTarget.value = null
  if (!id) return
  try {
    await deleteCertificate(id)
    toast.add({ title: 'Certificate deleted', color: 'success' })
  } catch (err) {
    // Surface what the API said: "nothing was removed, try again" sent people
    // retrying a click that could never work, when the real answer was a chain
    // error they needed to read.
    toast.add({
      title: 'Could not delete certificate',
      description: apiErrorMessage(err, 'Nothing was removed. Please try again.'),
      color: 'error',
    })
  }
  await refresh()
}

async function confirmRevoke() {
  const id = revokeTarget.value
  revokeTarget.value = null
  if (!id) return
  try {
    // Writes to the chain, so this is seconds rather than instant, and it can
    // fail for reasons nobody here can fix. Say so instead of leaving the row
    // looking revoked when it is not.
    await revokeCertificateAsAdmin(id)
    toast.add({ title: 'Certificate revoked', color: 'success' })
  } catch (err) {
    toast.add({
      title: 'Could not revoke certificate',
      description: apiErrorMessage(err, 'The revocation was not recorded. Please try again.'),
      color: 'error',
    })
  }
  await refresh()
}
</script>

<template>
  <div>
    <AdminCertFormModal
      v-model:open="formOpen"
      :cert="formTarget"
      @saved="refresh()"
    />

    <AdminPageHeader title="Certificates" description="All certificates issued across the platform.">
      <template #actions>
        <UButton color="primary" icon="i-heroicons-plus" @click="openIssue">
          Issue certificate
        </UButton>
      </template>
    </AdminPageHeader>

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
      <template #cell-_actions="{ row }">
        <div class="row-actions">
          <AdminRowAction icon="i-heroicons-pencil-square" label="Edit" @click="openEdit(row)" />
          <AdminRowAction
            v-if="row.status === 'issued' && row.claimState === 'unclaimed'"
            icon="i-heroicons-paper-airplane"
            :label="resendingId === row.id ? 'Sending…' : 'Resend claim link'"
            :loading="resendingId === row.id"
            :disabled="!!resendingId"
            @click="resendClaim(row.id)"
          />
          <AdminRowAction
            v-if="row.status === 'issued'"
            icon="i-heroicons-x-circle"
            label="Revoke"
            danger
            @click="revokeTarget = row.id"
          />
          <AdminRowAction
            icon="i-heroicons-trash"
            label="Delete"
            danger
            @click="deleteTarget = row.id"
          />
        </div>
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

    <!--
      Delete is not a stronger revoke, it is a different thing, so the copy says
      what actually survives: the chain entry cannot be erased, and once the row
      is gone the public page reports the ID as invalid rather than revoked.
    -->
    <AdminConfirmDialog
      :open="!!deleteTarget"
      title="Delete certificate permanently"
      :message="`Erase &quot;${deleteTargetName}&quot; from the database. It will be revoked on the blockchain first, but the entry there can never be removed — and afterwards this ID reports as invalid, not revoked. Revoke instead unless the record must not exist.`"
      confirm-label="Delete permanently"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
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
