<script setup lang="ts">
import { formatDate } from '~/composables/useAdminMockData'
import type { Column } from '~/components/admin/Table.vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const { orgs, users, certs, suspendOrg, reactivateOrg } = useAdminMockData()

const org = computed(() => orgs.value.find(o => o.id === route.params.id))
const orgUsers = computed(() => users.value.filter(u => u.organizationId === org.value?.id))
const orgCerts = computed(() => certs.value.filter(c => c.organizationId === org.value?.id))

const suspendDialog = ref(false)
const reactivateDialog = ref(false)

function confirmSuspend() {
  if (org.value) suspendOrg(org.value.id)
  suspendDialog.value = false
}

function confirmReactivate() {
  if (org.value) reactivateOrg(org.value.id)
  reactivateDialog.value = false
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
    <NuxtLink to="/admin/organizations" class="back-link">
      <UIcon name="i-heroicons-arrow-left" class="size-4" />
      Organizations
    </NuxtLink>

    <div v-if="!org" class="not-found">
      <p>Organization not found.</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="org-header">
        <div class="org-logo-placeholder">
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
          <button class="btn-secondary" @click="useToast().add({ title: 'Coming soon', description: 'Issuer invitations will be available once backend is wired.' })">
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
  color: var(--text-secondary);
  font-size: 14px;
  padding: 40px 0;
}

/* Header */
.org-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.org-logo-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--accent-text);
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
  border-radius: 8px;
  margin-bottom: 32px;
  flex-wrap: wrap;
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
