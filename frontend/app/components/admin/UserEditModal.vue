<script setup lang="ts">
import { updateUser, type AdminUser } from '~/composables/useAdmin'

/**
 * Rename an account, or move an issuer between institutions.
 *
 * Email is deliberately absent: it is the account's identity in Supabase Auth
 * and on every certificate already issued to it, so changing it here would
 * desynchronise the two. Status has its own reversible control on the row.
 *
 * Moving an issuer does NOT rewrite the certificates they have already issued —
 * `certificates.organization_id` records who issued it at the time, and
 * rewriting that would falsify history.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{ user?: AdminUser | null }>()
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const { orgs } = useAdminOrgs()

/*
 * Only issuers belong to an institution. A recipient's profile must keep
 * organization_id null — 0001_init.sql enforces it — so the field is not
 * offered for them at all rather than offered and then rejected.
 */
const showOrg = computed(() => props.user?.role === 'issuer')

const orgItems = computed(() =>
  orgs.value.map((o) => ({ value: o.id, label: o.name })),
)

const form = reactive({ fullName: '', organizationId: '' })

const saving = ref(false)
const errorMessage = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  form.fullName = props.user?.name ?? ''
  form.organizationId = props.user?.organizationId ?? ''
  errorMessage.value = ''
})

const canSubmit = computed(
  () => form.fullName.trim().length >= 2 && !saving.value,
)

async function submit() {
  const user = props.user
  if (!user || !canSubmit.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    // PATCH refuses an empty body, and sending an unchanged organizationId is
    // harmless, so the name alone is enough to keep the request valid.
    await updateUser(user.id, {
      fullName: form.fullName.trim(),
      ...(showOrg.value && form.organizationId
        ? { organizationId: form.organizationId }
        : {}),
    })
    toast.add({ title: 'Account updated', color: 'success' })
    emit('saved')
    open.value = false
  } catch (err: unknown) {
    errorMessage.value =
      (err as { data?: { message?: string } })?.data?.message ??
      'Could not save the account. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Edit account">
    <template #body>
      <form class="form" @submit.prevent="submit">
        <div class="field">
          <label class="label" for="user-name">Full name</label>
          <UInput
            id="user-name"
            v-model="form.fullName"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label">Email</label>
          <p class="readonly">{{ user?.email }}</p>
          <p class="hint">
            The account's identity. Change it in Supabase Auth, not here.
          </p>
        </div>

        <div v-if="showOrg" class="field">
          <label class="label" for="user-org">Institution</label>
          <USelect
            id="user-org"
            v-model="form.organizationId"
            :items="orgItems"
            value-key="value"
            label-key="label"
            size="lg"
            :disabled="saving"
          />
          <p class="hint">
            Certificates already issued keep the institution they were issued
            under.
          </p>
        </div>

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
          :disabled="!canSubmit"
          @click="submit"
        >
          Save changes
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }

.label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.readonly {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--text-secondary);
  font-size: 14px;
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.45;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
