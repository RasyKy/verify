<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface CertFormData {
  institution?: string
  studentName?: string
  studentEmail?: string
  courseName?: string
  completionDate?: string
  expiryDate?: string | null
}

const props = withDefaults(
  defineProps<{
    initialData?: CertFormData
    isEdit?: boolean
    certId?: string
  }>(),
  { isEdit: false },
)

const emit = defineEmits<{
  success: []
  cancel: []
}>()

const toast = useToast()
const me = useMe()
const { courses: coursesStore, refresh: refreshCourses } = useCourses()

// The institution field is display-only: the backend takes the organization from
// the authenticated issuer's profile and discards whatever is submitted here.
// Sourced from /api/auth/me rather than user_metadata, which the user can edit.
const institutionFallback = computed(() => me.value?.organization?.name ?? '')

const today = new Date().toISOString().substring(0, 10)

const schema = z.object({
  institution: z.string().min(2, 'Must be at least 2 characters'),
  studentName: z.string().min(2, 'Must be at least 2 characters'),
  studentEmail: z.string().email('Enter a valid email address'),
  courseName: z.string().min(1, 'Please select or add a course'),
  completionDate: z
    .string()
    .min(1, 'Completion date is required')
    .refine((d) => d <= today, 'Cannot be a future date'),
})

type Schema = z.output<typeof schema>

function makeState() {
  return {
    institution: props.initialData?.institution ?? institutionFallback.value,
    studentName: props.initialData?.studentName ?? '',
    studentEmail: props.initialData?.studentEmail ?? '',
    courseName: props.initialData?.courseName ?? '',
    completionDate: props.initialData?.completionDate ?? '',
  }
}

const state = reactive(makeState())

// ── Expiry ────────────────────────────────────────────────────────────────────

const expiryType = ref<'none' | 'duration' | 'custom'>(
  props.initialData?.expiryDate ? 'custom' : 'none',
)
const duration = ref('1 year')
const customExpiryDate = ref(props.initialData?.expiryDate ?? '')

const minCustomExpiry = computed(() => {
  if (!state.completionDate) return ''
  const d = new Date(state.completionDate)
  d.setDate(d.getDate() + 1)
  return d.toISOString().substring(0, 10)
})

const computedExpiryDate = computed<string | null>(() => {
  if (expiryType.value === 'none') return null
  if (expiryType.value === 'custom') return customExpiryDate.value || null
  if (!state.completionDate) return null
  const base = new Date(state.completionDate)
  const parts = duration.value.split(' ')
  const amount = parts[0] ?? '1'
  const unit = parts[1] ?? 'year'
  const months = unit.startsWith('year') ? parseInt(amount) * 12 : parseInt(amount)
  base.setMonth(base.getMonth() + months)
  return base.toISOString().substring(0, 10)
})

// ── Courses ─────────────────────────────────────────────────────────────────

const courseQuery = ref('')
const courseMenuOpen = ref(false)
const savingCourse = ref(false)

/*
 * The selected course lives in `state.courseName` rather than in a separate
 * option object, so a course added inline — which is not in `coursesStore`
 * until the POST lands — still shows in the field.
 */
const courseModel = computed<string | undefined>({
  get: () => state.courseName || undefined,
  // The menu emits null when cleared; the schema expects a string.
  set: (name) => { state.courseName = name ?? '' },
})

const courseOptions = computed(() => {
  const names = coursesStore.value
  return state.courseName && !names.includes(state.courseName)
    ? [state.courseName, ...names]
    : names
})

/**
 * Adds a course the organization has never issued before, straight from the
 * certificate form.
 *
 * Selected immediately: the name is already valid for the certificate, so the
 * form should not wait on a round-trip that only updates the typeahead. Issuing
 * would register the course anyway, but saving it here means it is on the list
 * even if this form is abandoned. POST /api/courses is idempotent on
 * (organization, name), so a double-click cannot duplicate it.
 */
async function onCreateCourse(raw: string) {
  const name = raw.trim()
  if (!name) return

  state.courseName = name
  courseQuery.value = ''
  courseMenuOpen.value = false

  savingCourse.value = true
  try {
    await createCourse(name)
    await refreshCourses()
  } catch (err) {
    toast.add({
      title: 'Could not save the course to your list',
      description: apiErrorMessage(err),
      color: 'warning',
    })
  } finally {
    savingCourse.value = false
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

const isLoading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true
  const payload = {
    studentName: event.data.studentName,
    studentEmail: event.data.studentEmail,
    courseName: event.data.courseName,
    completionDate: event.data.completionDate,
    expiryDate: computedExpiryDate.value,
  }

  try {
    if (props.isEdit && props.certId) {
      // Presented as an edit; the backend revokes the old hash and issues a new
      // one, keeping the same certificate ID so existing QR codes still resolve.
      await updateCertificate(props.certId, payload)
      toast.add({ title: 'Certificate updated', color: 'success' })
    } else {
      const result = await issueCertificate({
        institution: event.data.institution,
        ...payload,
      })

      // Two things can be true at once: the certificate is genuinely issued and
      // on chain, AND the claim email did not send. Saying "claim email sent"
      // unconditionally would have the issuer waiting on mail that never
      // arrives, so report what actually happened.
      toast.add(
        result.claim_email_sent
          ? {
              title: 'Certificate issued',
              description: `Claim email sent to ${event.data.studentEmail}`,
              color: 'success' as const,
            }
          : {
              title: 'Certificate issued',
              description:
                'The claim email could not be sent — the certificate is valid and can be shared directly.',
              color: 'warning' as const,
            },
      )

      Object.assign(state, makeState())
      expiryType.value = 'none'
      duration.value = '1 year'
      customExpiryDate.value = ''
      courseQuery.value = ''
    }
    emit('success')
  } catch (err) {
    // Issuance writes to the blockchain, so a 503 here means "not issued, try
    // again" — never a silent failure that leaves the issuer believing it worked.
    toast.add({
      title: props.isEdit ? 'Could not update certificate' : 'Could not issue certificate',
      description: apiErrorMessage(err),
      color: 'error',
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
    <!-- Institution (full width) -->
    <UFormField name="institution" label="Institution">
      <UInput
        v-model="state.institution"
        placeholder="Institution name"
        :disabled="isEdit"
        class="w-full"
      >
        <template v-if="!isEdit" #trailing>
          <span class="autofill-badge text-xs font-medium px-1.5 py-0.5 rounded">Auto-filled</span>
        </template>
      </UInput>
    </UFormField>

    <!-- Student name + email (2-col) -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField name="studentName">
        <template #label>
          Recipient name <span class="text-red-500">*</span>
        </template>
        <UInput v-model="state.studentName" placeholder="Full name" class="w-full" />
      </UFormField>

      <UFormField name="studentEmail">
        <template #label>
          Recipient email <span class="text-red-500">*</span>
        </template>
        <UInput
          v-model="state.studentEmail"
          type="email"
          placeholder="email@example.com"
          class="w-full"
        />
      </UFormField>
    </div>

    <!-- Course name + Completion date (2-col) -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField name="courseName">
        <template #label>
          Course name <span class="text-red-500">*</span>
        </template>
        <UInputMenu
          v-model="courseModel"
          v-model:search-term="courseQuery"
          v-model:open="courseMenuOpen"
          :items="courseOptions"
          create-item="always"
          :loading="savingCourse"
          placeholder="Search or add a course..."
          class="w-full"
          @create="onCreateCourse"
        >
          <template #create-item-label="{ item }">
            Add &ldquo;{{ item }}&rdquo; as a new course
          </template>
        </UInputMenu>
        <template #help>
          Type to search your organization&rsquo;s courses, or type a new name to add it.
        </template>
      </UFormField>

      <UFormField name="completionDate">
        <template #label>
          Completion date <span class="text-red-500">*</span>
        </template>
        <UInput
          v-model="state.completionDate"
          type="date"
          :max="today"
          class="w-full"
        />
      </UFormField>
    </div>

    <!-- Expiry (custom radio card group) -->
    <div>
      <label class="block text-sm font-medium mb-1.5 expiry-label">Expiry date</label>
      <div class="expiry-group rounded-lg divide-y overflow-hidden">

        <!-- Option: No expiry -->
        <label
          class="radio-card flex items-center gap-3 p-4 cursor-pointer transition-colors"
          :class="expiryType === 'none' ? 'radio-card--selected' : ''"
        >
          <input v-model="expiryType" type="radio" value="none" class="size-4 shrink-0 radio-input" />
          <div>
            <p class="text-sm font-medium radio-title">No expiry</p>
            <p class="text-xs radio-hint">Certificate remains valid indefinitely</p>
          </div>
        </label>

        <!-- Option: Duration -->
        <label
          class="radio-card flex items-center gap-3 p-4 cursor-pointer transition-colors"
          :class="expiryType === 'duration' ? 'radio-card--selected' : ''"
        >
          <input v-model="expiryType" type="radio" value="duration" class="size-4 shrink-0 radio-input" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium radio-title">Duration</p>
            <p class="text-xs radio-hint">Auto-calculates from completion date</p>
          </div>
          <USelect
            v-model="duration"
            :items="['6 months', '1 year', '2 years', '3 years']"
            :disabled="expiryType !== 'duration'"
            class="w-28 shrink-0"
          />
        </label>

        <!-- Option: Custom date -->
        <label
          class="radio-card flex items-center gap-3 p-4 cursor-pointer transition-colors"
          :class="expiryType === 'custom' ? 'radio-card--selected' : ''"
        >
          <input v-model="expiryType" type="radio" value="custom" class="size-4 shrink-0 radio-input" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium radio-title">Custom date</p>
            <p class="text-xs radio-hint">Pick a specific expiry date</p>
          </div>
          <UInput
            v-model="customExpiryDate"
            type="date"
            :min="minCustomExpiry"
            :disabled="expiryType !== 'custom'"
            class="w-36 shrink-0"
          />
        </label>

      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex justify-end gap-2 pt-2">
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        :disabled="isLoading"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
      <button
        type="submit"
        :disabled="isLoading"
        class="btn-submit flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
      >
        <span v-if="isLoading" class="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
        {{ isEdit ? 'Save changes' : 'Issue certificate' }}
      </button>
    </div>
  </UForm>
</template>

<style scoped>
.autofill-badge {
  background: var(--accent-light);
  color: var(--accent-text);
}

.expiry-label {
  color: var(--text-primary);
}

.expiry-group {
  border: 1px solid var(--border);
  divide-color: var(--border);
}

.radio-card {
  background: var(--surface);
  border-color: var(--border);
}

.radio-card:hover {
  background: var(--surface-hover);
}

.radio-card--selected {
  background: var(--accent-light);
}

.radio-card--selected:hover {
  background: var(--accent-light);
}

.radio-input {
  accent-color: var(--accent);
}

.radio-title {
  color: var(--text-primary);
}

.radio-hint {
  color: var(--text-secondary);
}

.btn-submit {
  background: var(--accent);
  transition: background-color 0.15s ease;
}

.btn-submit:hover:not(:disabled) {
  background: var(--accent-text);
}
</style>
