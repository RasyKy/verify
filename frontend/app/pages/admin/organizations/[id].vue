<script setup lang="ts">
import { formatDate, setOrganizationStatus, deleteOrganization } from '~/composables/useAdmin'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
// Three shared lists, filtered here rather than fetched per-organization —
// they are already loaded for the sibling pages, so this page costs no
// extra round trip.
const { orgs, refresh: refreshOrgs } = useAdminOrgs()
const { users, refresh: refreshUsers } = useAdminUsers()
const { certs } = useAdminCerts()

const org = computed(() => orgs.value.find(o => o.id === route.params.id))
const orgUsers = computed(() => users.value.filter(u => u.organizationId === org.value?.id))
const orgCerts = computed(() => certs.value.filter(c => c.organizationId === org.value?.id))

const toast = useToast()
const inviteOpen = ref(false)
const editOpen = ref(false)
const deleteDialog = ref(false)

async function confirmDelete() {
  const id = org.value?.id
  deleteDialog.value = false
  if (!id) return
  try {
    await deleteOrganization(id)
    toast.add({ title: 'Institution deleted', color: 'success' })
    await refreshOrgs()
    await navigateTo('/admin/organizations')
  } catch (err: unknown) {
    // The backend refuses while issuers or certificates remain, and says which.
    toast.add({
      title: 'Could not delete this institution',
      description:
        (err as { data?: { message?: string } })?.data?.message ??
        'Please try again.',
      color: 'error',
    })
  }
}
const suspendDialog = ref(false)
const reactivateDialog = ref(false)

async function confirmSuspend() {
  const id = org.value?.id
  suspendDialog.value = false
  if (!id) return
  await setOrganizationStatus(id, 'suspended')
  await refreshOrgs()
}

async function confirmReactivate() {
  const id = org.value?.id
  reactivateDialog.value = false
  if (!id) return
  await setOrganizationStatus(id, 'active')
  await refreshOrgs()
}

const userColumns: Column[] = [
  { key: 'name',  label: 'Name',  sortable: true },
  { key: 'email', label: 'Email', sortable: true, hideMobile: true },
  { key: 'role',  label: 'Role',  sortable: true },
  { key: 'status',label: 'Status',sortable: true },
]

const certColumns: Column[] = [
  { key: 'recipientName', label: 'Recipient', sortable: true },
  { key: 'courseName',    label: 'Course',    sortable: true },
  { key: 'issuedAt',      label: 'Issued',    sortable: true, hideMobile: true },
  { key: 'status',        label: 'Status',    sortable: true },
]

const typeLabels: Record<string, string> = {
  'university':        'University',
  'bootcamp':          'Bootcamp',
  'professional-body': 'Professional body',
  'event':             'Event',
}
</script>

<template>
  <div>
    <AdminInviteIssuerModal
      v-model:open="inviteOpen"
      :organization-id="org?.id"
      @invited="refreshUsers()"
    />
    <AdminOrgFormModal
      v-model:open="editOpen"
      :org="org"
      @saved="refreshOrgs()"
    />

    <NuxtLink to="/admin/organizations" class="back-link">
      <UIcon name="i-heroicons-arrow-left" class="size-4" />
      Organizations
    </NuxtLink>

    <div v-if="!org" class="not-found">
      <UIcon name="i-heroicons-building-office-2" class="not-found-icon" />
      <p>Organization not found. It may have been removed or the link is incorrect.</p>
      <NuxtLink to="/admin/organizations" class="not-found-link">Back to organizations</NuxtLink>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="org-header">
        <!-- Real mark where the institution has one; the initial is the
             fallback, not the design. -->
        <img
          v-if="org.logoUrl"
          :src="org.logoUrl"
          :alt="org.name"
          class="org-logo"
        />
        <div v-else class="org-logo org-logo--placeholder">
          {{ org.name.charAt(0) }}
        </div>
        <div class="org-meta">
          <div class="org-name-row">
            <h1 class="org-name">{{ org.name }}</h1>
            <AdminStatusChip :status="org.status" />
          </div>
          <div class="org-details">
            <span>{{ typeLabels[org.type] ?? org.type }}</span>
            <span class="separator">·</span>
            <a :href="`https://${org.website}`" target="_blank" class="org-link">{{ org.website }}</a>
            <span class="separator">·</span>
            <span>Since {{ formatDate(org.createdAt) }}</span>
          </div>
        </div>
        <div class="org-actions">
          <button class="btn-secondary" @click="editOpen = true">
            Edit details
          </button>
          <button
            v-if="org.status === 'active'"
            class="btn-danger-outline"
            @click="suspendDialog = true"
          >
            Suspend organization
          </button>
          <button
            v-else
            class="btn-primary"
            @click="reactivateDialog = true"
          >
            Reactivate
          </button>
          <!-- Only offered once nothing depends on it; the backend refuses
               otherwise and names what is in the way. -->
          <button
            v-if="!orgUsers.length && !orgCerts.length"
            class="btn-danger-outline"
            @click="deleteDialog = true"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-val">{{ org.issuersCount }}</span>
          <span class="stat-lbl">Issuers</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ org.certificatesCount }}</span>
          <span class="stat-lbl">Certificates</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ formatDate(org.createdAt) }}</span>
          <span class="stat-lbl">Member since</span>
        </div>
      </div>

      <!-- Issuers section -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Issuers</h2>
          <button class="btn-secondary" @click="inviteOpen = true">
            Invite issuer
          </button>
        </div>
        <AdminTable :columns="userColumns" :rows="orgUsers" empty-message="No issuers in this organization.">
          <template #cell-role="{ value }"><AdminStatusChip :status="value" /></template>
          <template #cell-status="{ value }"><AdminStatusChip :status="value" /></template>
        </AdminTable>
      </div>

      <!-- Certificates section -->
      <div class="section">
        <h2 class="section-title">Certificates</h2>
        <AdminTable :columns="certColumns" :rows="orgCerts" empty-message="No certificates issued by this organization.">
          <template #cell-issuedAt="{ value }">
            <span class="date-cell">{{ formatDate(value) }}</span>
          </template>
          <template #cell-status="{ value }"><AdminStatusChip :status="value" /></template>
        </AdminTable>
      </div>
    </template>

    <!-- Dialogs -->
    <AdminConfirmDialog

      :open="deleteDialog"

      title="Delete institution"

      :message="`Permanently remove ${org?.name}. This is only possible because it has no issuers and no certificates — suspending is the reversible option.`"

      confirm-label="Delete permanently"

      variant="danger"

      @confirm="confirmDelete"

      @cancel="deleteDialog = false"

    />

    <AdminConfirmDialog
      :open="suspendDialog"
      title="Suspend organization"
      :message="`Suspending ${org?.name} will flag it on the platform. You can reactivate it at any time.`"
      confirm-label="Suspend"
      variant="danger"
      @confirm="confirmSuspend"
      @cancel="suspendDialog = false"
    />
    <AdminConfirmDialog
      :open="reactivateDialog"
      title="Reactivate organization"
      :message="`Reactivate ${org?.name} and restore access for its issuers?`"
      confirm-label="Reactivate"
      @confirm="confirmReactivate"
      @cancel="reactivateDialog = false"
    />
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 24px;
}

.back-link:hover {
  color: var(--text-primary);
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
  padding: 56px 0;
}

.not-found-icon {
  width: 32px;
  height: 32px;
  color: var(--text-tertiary);
}

.not-found-link {
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
}

.not-found-link:hover {
  text-decoration: underline;
}

/* Header */
.org-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.org-logo {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  flex-shrink: 0;
  /* contain, not cover: institution marks are wordmarks and crests of very
     different proportions, and cropping one to fill a square mangles it. */
  object-fit: contain;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 4px;
}

.org-logo--placeholder {
  background: var(--accent-light);
  border-color: transparent;
  color: var(--accent-text);
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.org-meta {
  flex: 1;
  min-width: 0;
}

.org-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.org-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.org-details {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.separator {
  color: var(--text-tertiary);
}

.org-link {
  color: var(--accent);
  text-decoration: none;
}

.org-link:hover {
  text-decoration: underline;
}

.org-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.btn-danger-outline {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--status-revoked-text);
  background: var(--status-revoked-bg);
  border: 1px solid color-mix(in srgb, var(--status-revoked-text) 30%, transparent);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-danger-outline:hover {
  opacity: 0.85;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--accent);
  border: none;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-secondary {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

/* Stats row */
.stats-row {
  display: flex;
  gap: 32px;
  padding: 16px 20px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  margin-bottom: 32px;
  flex-wrap: wrap;
  box-shadow: var(--shadow-panel);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-val {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-lbl {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Sections */
.section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.section-header .section-title {
  margin: 0;
}

.date-cell {
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
