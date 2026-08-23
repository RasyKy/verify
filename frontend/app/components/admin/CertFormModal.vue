<script setup lang="ts">
import {
  issueCertificateAsAdmin,
  updateCertificateAsAdmin,
  type AdminCert,
} from '~/composables/useAdmin'

/**
 * Issue or correct a certificate as a platform admin.
 *
 * Two things separate this from the issuer's own form. An admin belongs to no
 * institution, so the owning organization has to be named explicitly — the
 * backend has no default to fall back on. And an edit is not an UPDATE: it
 * revokes the old hash and anchors a new one, keeping the same certificate ID
 * (FR-MGMT-04). That is a chain write, so it is slow and it is worth telling
 * the admin what they are actually about to do.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** Present = edit that certificate. Absent = issue a new one. */
  cert?: AdminCert | null
}>()

const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const { orgs } = useAdminOrgs()

const isEdit = computed(() => !!props.cert)

const orgItems = computed(() =>
  orgs.value.map((o) => ({ value: o.id, label: o.name })),
)

const form = reactive({
  organizationId: '',
  studentName: '',
  studentEmail: '',
  courseName: '',
  completionDate: '',
  expiryDate: '',
})

const saving = ref(false)
const errorMessage = ref('')

/*
 * Repopulate every time the dialog opens rather than on prop change: the same
 * component instance is reused for every row, and a stale form showing the
 * previous recipient's name is how the wrong person gets edited.
 */
watch(open, (isOpen) => {
  if (!isOpen) return
  errorMessage.value = ''
  const c = props.cert
  form.organizationId = c?.organizationId ?? orgItems.value[0]?.value ?? ''
  form.studentName = c?.recipientName ?? ''
  form.studentEmail = c?.recipientEmail ?? ''
  form.courseName = c?.courseName ?? ''
  form.completionDate = c?.completionDate ?? ''
  form.expiryDate = c?.expiryDate ?? ''
})

const canSubmit = computed(
  () =>
    form.studentName.trim().length >= 2 &&
    /.+@.+\..+/.test(form.studentEmail.trim()) &&
    form.courseName.trim().length >= 2 &&
    !!form.completionDate &&
    (isEdit.value || !!form.organizationId) &&
    !saving.value,
)

/** The backend rejects this too; catching it here saves a round trip. */
const dateProblem = computed(() => {
  if (!form.expiryDate || !form.completionDate) return null
  return form.expiryDate > form.completionDate
    ? null
    : 'Expiry must be after the completion date'
})

async function submit() {
  if (!canSubmit.value || dateProblem.value) return
  saving.value = true
  errorMessage.value = ''

  const body = {
    studentName: form.studentName.trim(),
    studentEmail: form.studentEmail.trim(),
    courseName: form.courseName.trim(),
    completionDate: form.completionDate,
    expiryDate: form.expiryDate || null,
  }

  try {
    if (props.cert) {
      await updateCertificateAsAdmin(props.cert.id, body)
      toast.add({
        title: 'Certificate corrected',
        description: 'The old hash is revoked and a new one is anchored.',
        color: 'success',
      })
    } else {
      const result = await issueCertificateAsAdmin({
        organizationId: form.organizationId,
        ...body,
      })
      // Two things can be true at once: issued on chain, and the claim email
      // refused. Say which, or the admin waits on mail that never arrives.
      toast.add(
        (result as { claim_email_sent?: boolean })?.claim_email_sent === false
          ? {
              title: 'Certificate issued',
              description:
                'The claim email could not be sent — use the resend action to get a fresh link.',
              color: 'warning' as const,
            }
          : {
              title: 'Certificate issued',
              description: `Claim email sent to ${body.studentEmail}`,
              color: 'success' as const,
            },
      )
    }
    emit('saved')
    open.value = false
  } catch (err: unknown) {
    errorMessage.value =
      (err as { data?: { message?: string } })?.data?.message ??
      'Could not save the certificate. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Correct certificate' : 'Issue a certificate'"
  >
    <template #body>
      <form class="form" @submit.prevent="submit">
        <div v-if="!isEdit" class="field">
          <label class="label" for="cert-org">Institution</label>
          <USelect
            id="cert-org"
            v-model="form.organizationId"
            :items="orgItems"
            value-key="value"
            label-key="label"
            size="lg"
            :disabled="saving"
          />
          <p class="hint">
            The certificate is issued on this institution's behalf; you are
            recorded as the issuer.
          </p>
        </div>

        <div v-else class="notice">
          <UIcon name="i-heroicons-information-circle" class="size-4 shrink-0" />
          <span>
            Correcting revokes the certificate's current hash and anchors a new
            one on chain. The certificate ID does not change, and the institution
            cannot be moved.
          </span>
        </div>

        <div class="field">
          <label class="label" for="cert-name">Recipient name</label>
          <UInput
            id="cert-name"
            v-model="form.studentName"
            placeholder="Sophea Kim"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label" for="cert-email">Recipient email</label>
          <UInput
            id="cert-email"
            v-model="form.studentEmail"
            type="email"
            placeholder="sophea@example.com"
            size="lg"
            :disabled="saving"
          />
          <p class="hint">The claim link is sent here.</p>
        </div>

        <div class="field">
          <label class="label" for="cert-course">Course</label>
          <UInput
            id="cert-course"
            v-model="form.courseName"
            placeholder="Advanced Web Development"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="row">
          <div class="field">
            <label class="label" for="cert-completed">Completion date</label>
            <UInput
              id="cert-completed"
              v-model="form.completionDate"
              type="date"
              size="lg"
              :disabled="saving"
            />
          </div>
          <div class="field">
            <label class="label" for="cert-expiry">Expiry date</label>
            <UInput
              id="cert-expiry"
              v-model="form.expiryDate"
              type="date"
              size="lg"
              :disabled="saving"
            />
            <p class="hint">Leave empty for a certificate that never expires.</p>
          </div>
        </div>

        <p v-if="dateProblem" class="problem">{{ dateProblem }}</p>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="errorMessage"
        />
      </form>
    </template>

    <template #footer>
      <div class="footer">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="open = false"
        >
          Cancel
        </UButton>
        <UButton
          color="primary"
          :loading="saving"
          :disabled="!canSubmit || !!dateProblem"
          @click="submit"
        >
          {{ isEdit ? 'Save correction' : 'Issue certificate' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 520px) {
  .row { grid-template-columns: 1fr; }
}

.label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.45;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-hover);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.problem {
  font-size: 12.5px;
  color: var(--status-expired-text);
  margin: -4px 0 0;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
