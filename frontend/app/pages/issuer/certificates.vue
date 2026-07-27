<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'issuer' })

// ── Types ─────────────────────────────────────────────────────────────────────

interface Certificate {
  id: string
  student_name: string
  student_email: string
  course_name: string
  completion_date: string
  expiry_date: string | null
  status: 'valid' | 'revoked' | 'expired' | 'unclaimed'
  institution_id: string
  issued_at: string
  revoked_at: string | null
}

// ── Data ──────────────────────────────────────────────────────────────────────

const { data: fetchedCerts, pending, refresh } = useFetch<Certificate[]>('/api/certificates', {
  default: () => [],
})

const certs = ref<Certificate[]>([])
watch(fetchedCerts, (data) => { if (data) certs.value = [...data] }, { immediate: true })

// Shared state: issue modal open trigger + refresh signal from layout
const issueModalOpen = useState<boolean>('issue-modal', () => false)
const certsRefreshKey = useState<number>('certs-refresh', () => 0)
watch(certsRefreshKey, async () => {
  await refresh()
  certs.value = [...(fetchedCerts.value ?? [])]
})

// ── Filters ───────────────────────────────────────────────────────────────────

const search = ref('')
const statusFilter = ref('')

const statusFilterOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Valid', value: 'valid' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'Expired', value: 'expired' },
]

const filteredCerts = computed(() => {
  let result = certs.value
  const term = search.value.toLowerCase().trim()
  if (term) {
    result = result.filter(
      (c) =>
        c.student_name.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term),
    )
  }
  if (statusFilter.value) {
    result = result.filter((c) => c.status === statusFilter.value)
  }
  return result
})

// ── Table columns ─────────────────────────────────────────────────────────────

const columns: TableColumn<Certificate>[] = [
  { accessorKey: 'student_name', header: 'Recipient name' },
  { accessorKey: 'course_name', header: 'Course' },
  { accessorKey: 'completion_date', header: 'Completion date' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: '' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; style: string }> = {
  valid:     { label: 'Valid',      style: 'background: var(--status-valid-bg);     color: var(--status-valid-text)' },
  revoked:   { label: 'Revoked',    style: 'background: var(--status-revoked-bg);   color: var(--status-revoked-text)' },
  expired:   { label: 'Expired',    style: 'background: var(--status-expired-bg);   color: var(--status-expired-text)' },
  unclaimed: { label: 'Unclaimed',  style: 'background: var(--status-unclaimed-bg); color: var(--status-unclaimed-text)' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── View modal ────────────────────────────────────────────────────────────────

const detailModalOpen = ref(false)
const viewingCert = ref<Certificate | null>(null)

function openDetail(cert: Certificate) {
  viewingCert.value = cert
  detailModalOpen.value = true
}

// ── Edit modal ────────────────────────────────────────────────────────────────

const editModalOpen = ref(false)
const editingCert = ref<Certificate | null>(null)

function openEdit(cert: Certificate) {
  editingCert.value = cert
  editModalOpen.value = true
}

async function onEditSuccess() {
  editModalOpen.value = false
  await refresh()
  certs.value = [...(fetchedCerts.value ?? [])]
}

// ── Revoke modal ──────────────────────────────────────────────────────────────

const revokeModalOpen = ref(false)
const revokingCert = ref<Certificate | null>(null)

function openRevoke(cert: Certificate) {
  revokingCert.value = cert
  revokeModalOpen.value = true
}

function onCertRevoked(certId: string) {
  const idx = certs.value.findIndex((c) => c.id === certId)
  if (idx !== -1) {
    certs.value[idx] = { ...certs.value[idx]!, status: 'revoked' }
  }
}
</script>

<template>
  <div>
    <!-- Page header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold page-title">Certificates</h1>
        <p class="text-sm mt-1 page-subtitle">View, search, and manage all issued certificates.</p>
      </div>
      <button class="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" @click="issueModalOpen = true">
        <UIcon name="i-heroicons-plus" class="size-4" />
        Issue certificate
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex items-center gap-3 mb-4">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search by student name or certificate ID..."
        class="flex-1"
      />
      <USelect
        v-model="statusFilter"
        :items="statusFilterOptions"
        value-key="value"
        label-key="label"
        class="w-40"
      />
    </div>

    <!-- Table -->
    <UTable
      :data="filteredCerts"
      :columns="columns"
      :loading="pending"
      class="w-full"
    >
      <!-- Completion date cell -->
      <template #completion_date-cell="{ row }">
        {{ formatDate(row.original.completion_date) }}
      </template>

      <!-- Status cell -->
      <template #status-cell="{ row }">
        <span
          :style="statusConfig[row.original.status]?.style"
          class="text-xs font-medium px-2 py-0.5 rounded-full"
        >
          {{ statusConfig[row.original.status]?.label }}
        </span>
      </template>

      <!-- Actions cell -->
      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end gap-1">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-eye"
            size="sm"
            aria-label="View certificate"
            @click="openDetail(row.original)"
          />
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-pencil-square"
            size="sm"
            aria-label="Edit certificate"
            @click="openEdit(row.original)"
          />
          <UButton
            v-if="row.original.status !== 'revoked'"
            variant="ghost"
            color="error"
            icon="i-heroicons-no-symbol"
            size="sm"
            aria-label="Revoke certificate"
            @click="openRevoke(row.original)"
          />
          <span v-else class="w-8" />
        </div>
      </template>

      <!-- Empty state -->
      <template #empty>
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <template v-if="certs.length === 0 && !pending">
            <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-document-text" class="size-6 text-gray-400" />
            </div>
            <h3 class="text-sm font-medium mb-1 page-title">No certificates issued yet</h3>
            <p class="text-sm page-subtitle mb-4">Certificates you issue will appear here.</p>
            <button
              class="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              @click="issueModalOpen = true"
            >
              <UIcon name="i-heroicons-plus-circle" class="size-4" />
              Issue your first certificate
            </button>
          </template>
          <template v-else>
            <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-magnifying-glass" class="size-6 text-gray-400" />
            </div>
            <p class="text-sm page-subtitle">No certificates match your search.</p>
          </template>
        </div>
      </template>
    </UTable>

    <!-- Detail modal -->
    <IssuerCertificateDetailModal
      v-model:open="detailModalOpen"
      :cert="viewingCert"
    />

    <!-- Edit modal (issue modal for editing is page-local since it needs cert data) -->
    <UModal v-model:open="editModalOpen" title="Edit certificate">
      <template #body>
        <IssuerCertificateForm
          v-if="editingCert"
          :initial-data="{
            studentName: editingCert.student_name,
            studentEmail: editingCert.student_email,
            courseName: editingCert.course_name,
            completionDate: editingCert.completion_date,
            expiryDate: editingCert.expiry_date,
          }"
          :is-edit="true"
          :cert-id="editingCert.id"
          @success="onEditSuccess"
          @cancel="editModalOpen = false"
        />
      </template>
    </UModal>

    <!-- Revoke modal -->
    <IssuerRevokeConfirmModal
      v-model:open="revokeModalOpen"
      :cert="revokingCert"
      @revoked="onCertRevoked"
    />
  </div>
</template>

<style scoped>
.page-title {
  color: var(--text-primary);
}

.page-subtitle {
  color: var(--text-secondary);
}

.btn-primary {
  background: var(--accent);
  transition: background-color 0.15s ease;
}

.btn-primary:hover {
  background: var(--accent-text);
}
</style>
