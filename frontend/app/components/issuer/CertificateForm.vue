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

const user = useSupabaseUser()
const toast = useToast()

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
    institution: props.initialData?.institution ?? user.value?.user_metadata?.institution_name ?? '',
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

// ── Courses ───────────────────────────────────────────────────────────────────

const selectedCourse = ref<{ label: string; value: string } | undefined>(
  props.initialData?.courseName
    ? { label: props.initialData.courseName, value: props.initialData.courseName }
    : undefined,
)
const courseQuery = ref('')

const { data: coursesData } = useFetch<string[]>('/api/courses', { default: () => [] })
const courses = ref<string[]>([])
watch(coursesData, (data) => { if (data) courses.value = [...data] }, { immediate: true })

const courseOptions = computed(() => {
  const term = courseQuery.value.toLowerCase().trim()
  const filtered = courses.value.filter((c) => !term || c.toLowerCase().includes(term))
  const opts: Array<{ label: string; value: string }> = filtered.map((c) => ({ label: c, value: c }))
  if (term && !courses.value.some((c) => c.toLowerCase() === term)) {
    opts.push({ label: `+ Add "${courseQuery.value}"`, value: '__create__' })
  }
  return opts
})

watch(selectedCourse, async (item) => {
  if (!item) { state.courseName = ''; return }
  if (item.value === '__create__') {
    const name = courseQuery.value.trim()
    selectedCourse.value = undefined
    state.courseName = ''
    try {
      await $fetch('/api/courses', { method: 'POST', body: { name } })
      courses.value.push(name)
      selectedCourse.value = { label: name, value: name }
      state.courseName = name
      courseQuery.value = ''
    } catch {
      toast.add({ title: 'Error', description: 'Failed to add course', color: 'error' })
    }
  } else {
    state.courseName = item.value
  }
})

// ── Submit ────────────────────────────────────────────────────────────────────

const isLoading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true
  try {
    if (props.isEdit && props.certId) {
      await $fetch(`/api/certificates/${props.certId}`, {
        method: 'PUT',
        body: {
          studentName: event.data.studentName,
          studentEmail: event.data.studentEmail,
          courseName: event.data.courseName,
          completionDate: event.data.completionDate,
          expiryDate: computedExpiryDate.value,
        },
      })
      toast.add({ title: 'Certificate updated', color: 'success' })
    } else {
      await $fetch('/api/certificates', {
        method: 'POST',
        body: {
          institution: event.data.institution,
          studentName: event.data.studentName,
          studentEmail: event.data.studentEmail,
          courseName: event.data.courseName,
          completionDate: event.data.completionDate,
          expiryDate: computedExpiryDate.value,
        },
      })
      toast.add({
        title: 'Certificate issued',
        description: `Claim email sent to ${event.data.studentEmail}`,
        color: 'success',
      })
      Object.assign(state, makeState())
      expiryType.value = 'none'
      duration.value = '1 year'
      customExpiryDate.value = ''
      selectedCourse.value = undefined
      courseQuery.value = ''
    }
    emit('success')
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err?.data?.message ?? 'Something went wrong. Please try again.',
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
          v-model="selectedCourse"
          v-model:query="courseQuery"
          :items="courseOptions"
          option-attribute="label"
          placeholder="Search or add a course..."
          class="w-full"
        />
        <template #help>
          Type to search existing courses or add a new one.
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
