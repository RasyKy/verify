<script setup lang="ts">
import { inviteIssuer, useAdminOrgs } from '~/composables/useAdmin'

const props = defineProps<{
  /** Pre-selects and locks the institution, for the org detail page. */
  organizationId?: string
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ invited: [] }>()

const toast = useToast()
const { orgs } = useAdminOrgs()

const orgOptions = computed(() =>
  orgs.value.map((o) => ({ value: o.id, label: o.name })),
)

const form = reactive({
  fullName: '',
  email: '',
  organizationId: props.organizationId ?? '',
})

// The org detail page opens this with its own institution already decided.
watch(
  () => props.organizationId,
  (id) => { if (id) form.organizationId = id },
  { immediate: true },
)

const saving = ref(false)
const errorMessage = ref('')

const canSubmit = computed(
  () =>
    form.fullName.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email.trim()) &&
    Boolean(form.organizationId),
)

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const email = form.email.trim()
    const { inviteEmailSent } = await inviteIssuer({
      fullName: form.fullName.trim(),
      email,
      organizationId: form.organizationId,
    })
    // The account exists either way. Saying "invited" when the backend has no
    // mail transport would leave an admin waiting on an email that was never
    // sent, so the two outcomes read differently.
    toast.add(
      inviteEmailSent
        ? {
            title: 'Issuer invited',
            description: `${email} can set a password from the emailed link.`,
            color: 'success' as const,
          }
        : {
            title: 'Account created, no email sent',
            description: `Email is not configured on the server. Ask ${email} to use "Forgot password" on the sign-in page.`,
            color: 'warning' as const,
          },
    )
    emit('invited')
    open.value = false
    form.fullName = ''
    form.email = ''
  } catch (err: unknown) {
    errorMessage.value =
      (err as { data?: { message?: string } })?.data?.message ??
      'Could not invite this issuer. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Invite an issuer">
    <template #body>
      <form class="form" @submit.prevent="submit">
        <p class="lede">
          They receive an email inviting them to choose their own password,
          confirmed with a one-time code. No password is set here, and none is
          ever sent by mail.
        </p>

        <div class="field">
          <label class="label" for="inv-name">Full name</label>
          <UInput
            id="inv-name"
            v-model="form.fullName"
            placeholder="Sok Dara"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label" for="inv-email">Work email</label>
          <UInput
            id="inv-email"
            v-model="form.email"
            type="email"
            placeholder="dara@rupp.edu.kh"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label" for="inv-org">Institution</label>
          <USelect
            id="inv-org"
            v-model="form.organizationId"
            :items="orgOptions"
            value-key="value"
            label-key="label"
            placeholder="Select an institution"
            size="lg"
            :disabled="saving || Boolean(organizationId)"
          />
          <p class="hint">
            Every certificate they issue is scoped to this institution and
            cannot be moved later.
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
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="open = false">
          Cancel
        </UButton>
        <UButton color="primary" :loading="saving" :disabled="!canSubmit" @click="submit">
          Send invitation
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 18px; }
.field { display: flex; flex-direction: column; gap: 6px; }

.lede {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0;
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

.footer { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
</style>
