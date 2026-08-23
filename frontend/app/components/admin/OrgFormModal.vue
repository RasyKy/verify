<script setup lang="ts">
import {
  createOrganization,
  updateOrganization,
  type Org,
  type OrgType,
} from '~/composables/useAdmin'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** Present = edit that institution. Absent = create a new one. */
  org?: Org | null
}>()

/*
 * `created` is kept for callers that only ever create; `saved` fires for both
 * so an edit-capable page can bind one handler.
 */
const emit = defineEmits<{ created: []; saved: [] }>()

const isEdit = computed(() => !!props.org)

const toast = useToast()

const TYPES: Array<{ value: OrgType; label: string }> = [
  { value: 'university', label: 'University or college' },
  { value: 'bootcamp', label: 'Bootcamp or training centre' },
  { value: 'professional-body', label: 'Professional body' },
  { value: 'event', label: 'Event or conference' },
]

/*
 * The logo files that ship in /public. An upload pipeline would need storage
 * and a signed-URL flow; until that exists, picking from what is already
 * deployed beats a free-text field nobody can fill in correctly.
 *
 * "No logo" carries a sentinel rather than '': reka-ui's SelectItem THROWS on
 * an empty-string value (it reserves '' for clearing the selection), and the
 * throw happens when the listbox mounts — so an empty value here does not
 * degrade the option, it takes the whole dialog down the moment the dropdown
 * is opened. The sentinel is translated back to "omit the field" in submit().
 */
const NO_LOGO = 'none'

const LOGOS = [
  { value: NO_LOGO, label: 'No logo' },
  { value: '/rupp-logo.png', label: 'Royal University of Phnom Penh' },
  { value: '/istad-logo.png', label: 'ISTAD' },
  { value: '/aupp-technology-center.webp', label: 'AUPP Technology Center' },
  { value: '/mekong-coding-academy-logo.png', label: 'Mekong Coding Academy' },
  { value: '/training-academy-logo.png', label: 'Training Academy' },
  {
    value: '/ministry-of-education-logo.svg',
    label: 'Ministry of Education, Youth and Sport',
  },
  {
    value: '/ministry-of-economy-and-finance-logo.png',
    label: 'Ministry of Economy and Finance',
  },
  { value: '/ministry-of-interior-logo.png', label: 'Ministry of Interior' },
  {
    value: '/digital-government-committee.png',
    label: 'Digital Government Committee',
  },
  { value: '/google-logo.png', label: 'Google' },
]

const form = reactive({
  name: '',
  type: 'university' as OrgType,
  website: '',
  logoUrl: NO_LOGO,
  accredited: false,
})

const saving = ref(false)
const errorMessage = ref('')

const canSubmit = computed(() => form.name.trim().length >= 2)

/*
 * Refilled every time the dialog opens rather than on prop change: one instance
 * serves every row, and a form still holding the previous institution is how
 * the wrong one gets renamed.
 */
watch(open, (isOpen) => {
  if (!isOpen) return
  const o = props.org
  form.name = o?.name ?? ''
  form.type = o?.type ?? 'university'
  form.website = o?.website ?? ''
  form.logoUrl = o?.logoUrl || NO_LOGO
  form.accredited = o?.accredited ?? false
  errorMessage.value = ''
})

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    if (props.org) {
      // PATCH: send every field the form owns, so clearing the website or
      // removing the logo actually takes effect. `null` is how the backend
      // spells "remove this logo"; an omitted key would leave the old one.
      await updateOrganization(props.org.id, {
        name: form.name.trim(),
        type: form.type,
        website: form.website.trim(),
        logoUrl: form.logoUrl === NO_LOGO ? null : form.logoUrl,
        accredited: form.accredited,
      })
      toast.add({ title: 'Institution updated', color: 'success' })
    } else {
      await createOrganization({
        name: form.name.trim(),
        type: form.type,
        ...(form.website.trim() ? { website: form.website.trim() } : {}),
        ...(form.logoUrl !== NO_LOGO ? { logoUrl: form.logoUrl } : {}),
        accredited: form.accredited,
      })
      toast.add({ title: 'Institution created', color: 'success' })
      emit('created')
    }
    emit('saved')
    open.value = false
  } catch (err: unknown) {
    // The most likely failure is a duplicate slug, and the backend says so
    // precisely — surface that rather than a generic retry message.
    errorMessage.value =
      (err as { data?: { message?: string } })?.data?.message ??
      'Could not create the institution. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit institution' : 'Add an institution'"
  >
    <template #body>
      <form class="form" @submit.prevent="submit">
        <div class="field">
          <label class="label" for="org-name">Institution name</label>
          <UInput
            id="org-name"
            v-model="form.name"
            placeholder="Royal University of Phnom Penh"
            size="lg"
            :disabled="saving"
          />
          <p class="hint">
            {{
              isEdit
                ? 'The URL slug was derived from the original name and does not change.'
                : 'The URL slug is derived from this. It can be changed later.'
            }}
          </p>
        </div>

        <div class="field">
          <label class="label" for="org-type">Type</label>
          <USelect
            id="org-type"
            v-model="form.type"
            :items="TYPES"
            value-key="value"
            label-key="label"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label" for="org-web">Website</label>
          <UInput
            id="org-web"
            v-model="form.website"
            placeholder="https://rupp.edu.kh"
            size="lg"
            :disabled="saving"
          />
        </div>

        <div class="field">
          <label class="label" for="org-logo">Logo</label>
          <USelect
            id="org-logo"
            v-model="form.logoUrl"
            :items="LOGOS"
            value-key="value"
            label-key="label"
            size="lg"
            :disabled="saving"
          />
          <div v-if="form.logoUrl !== NO_LOGO" class="logo-preview">
            <img :src="form.logoUrl" alt="" />
            <span>Shown on the public registry and verification pages.</span>
          </div>
        </div>

        <label class="checkline">
          <UCheckbox v-model="form.accredited" :disabled="saving" />
          <span>
            <strong>Listed as accredited</strong>
            <span class="hint">
              Controls the public registry only — separate from whether the
              institution is active.
            </span>
          </span>
        </label>

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
          {{ isEdit ? 'Save changes' : 'Create institution' }}
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

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.45;
}

.logo-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-hover);
  font-size: 12px;
  color: var(--text-tertiary);
}

.logo-preview img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  flex-shrink: 0;
}

.checkline {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.checkline strong {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.footer { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
</style>
