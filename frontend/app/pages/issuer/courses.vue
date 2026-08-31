<script setup lang="ts">
import {
  apiErrorMessage,
  createCourse,
  updateCourseTemplate,
  useCoursesFull,
  type CertificateTemplate,
  type CourseWithTemplate,
} from '~/composables/useCertificates'

definePageMeta({ layout: 'issuer' })

const { courses, pending, refresh, error } = useCoursesFull()
const toast = useToast()

const loadError = computed(() =>
  error.value ? apiErrorMessage(error.value, 'Could not load courses') : null,
)

const TEMPLATES: Array<{ value: CertificateTemplate; label: string; description: string; tag: string }> = [
  { value: 'classic', label: 'Classic', description: 'Cream paper, gold rule border, serif type.', tag: 'Cream, gold border' },
  { value: 'modern', label: 'Modern', description: 'White canvas, bold sans type, one accent block.', tag: 'White, bold sans' },
  { value: 'editorial', label: 'Editorial', description: 'Dark ground, monospace accents, verification panel.', tag: 'Dark, monospace' },
]

function templateInfo(value: CertificateTemplate) {
  return TEMPLATES.find((t) => t.value === value) ?? TEMPLATES[0]
}

// Only one course's picker is open at a time — expanding all of them at
// once on an institution with many courses would be an unusable wall of
// full-size certificate previews.
const expandedId = ref<string | null>(null)
const busyId = ref<string | null>(null)

function toggleExpanded(course: CourseWithTemplate) {
  expandedId.value = expandedId.value === course.id ? null : course.id
}

async function onSelectTemplate(course: CourseWithTemplate, template: CertificateTemplate) {
  if (template === course.certificateTemplate) {
    expandedId.value = null
    return
  }
  busyId.value = course.id
  try {
    await updateCourseTemplate(course.id, template)
    await refresh()
    expandedId.value = null
    toast.add({
      title: 'Template updated',
      description: `${course.name} now uses the ${templateInfo(template).label} template.`,
      color: 'success',
    })
  } catch (err: unknown) {
    toast.add({ title: 'Could not update template', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

/**
 * Creating a course and choosing its template were two disconnected steps
 * before this: type a new name into the issuance form's typeahead (which
 * always defaults to 'classic'), then remember to come back here and fix
 * it. This dialog does both in one action instead.
 */
const createModalOpen = ref(false)
const newCourseName = ref('')
const newCourseTemplate = ref<CertificateTemplate>('classic')
const creating = ref(false)

function openCreateModal() {
  newCourseName.value = ''
  newCourseTemplate.value = 'classic'
  createModalOpen.value = true
}

async function onCreateCourse() {
  const name = newCourseName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await createCourse(name, newCourseTemplate.value)
    await refresh()
    createModalOpen.value = false
    toast.add({ title: 'Course added', description: name, color: 'success' })
  } catch (err: unknown) {
    toast.add({ title: 'Could not add course', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold page-title">Courses</h1>
        <p class="text-sm mt-1 page-subtitle">
          Choose which certificate template each course uses. Institution logo, signature,
          and signatory are set once in
          <NuxtLink to="/issuer/settings" class="text-link">Settings</NuxtLink>.
        </p>
      </div>
      <UButton icon="i-heroicons-plus" class="shrink-0" @click="openCreateModal">New course</UButton>
    </div>

    <UAlert
      v-if="loadError"
      class="mb-4"
      color="error"
      variant="subtle"
      icon="i-heroicons-exclamation-triangle"
      title="Could not load courses"
      :description="loadError"
    />

    <div v-if="!pending && courses.length === 0 && !loadError" class="empty-state">
      <div class="empty-icon">
        <UIcon name="i-heroicons-academic-cap" class="size-6" />
      </div>
      <h3 class="text-sm font-medium mb-1 page-title">No courses yet</h3>
      <p class="text-sm page-subtitle">
        Add one above, or issue a certificate for a new course name and it'll appear here.
      </p>
    </div>

    <ul v-else class="course-list">
      <li v-for="course in courses" :key="course.id" class="course-item">
        <button type="button" class="course-row" @click="toggleExpanded(course)">
          <span class="course-preview">
            <img
              :src="`/certificate-templates/${course.certificateTemplate}.png`"
              :alt="`${templateInfo(course.certificateTemplate).label} template preview`"
              class="course-preview-image"
              loading="lazy"
            />
          </span>
          <span class="course-info">
            <span class="course-name">{{ course.name }}</span>
            <span class="course-template-label">{{ templateInfo(course.certificateTemplate).label }} template</span>
          </span>
          <UIcon
            name="i-heroicons-chevron-down"
            class="course-chevron"
            :class="{ 'course-chevron--open': expandedId === course.id }"
          />
        </button>

        <div v-if="expandedId === course.id" class="template-picker">
          <button
            v-for="tpl in TEMPLATES"
            :key="tpl.value"
            type="button"
            class="template-card"
            :class="{ 'template-card--active': course.certificateTemplate === tpl.value }"
            :disabled="busyId === course.id"
            @click="onSelectTemplate(course, tpl.value)"
          >
            <span class="template-preview">
              <img :src="`/certificate-templates/${tpl.value}.png`" :alt="`${tpl.label} template preview`" class="template-preview-image" loading="lazy" />
            </span>
            <span class="template-info">
              <span class="template-name">{{ tpl.label }}</span>
              <span class="template-desc">{{ tpl.description }}</span>
            </span>
          </button>
        </div>
      </li>
    </ul>

    <UModal v-model:open="createModalOpen" title="New course" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-5">
          <UFormField name="courseName" label="Course name">
            <UInput v-model="newCourseName" placeholder="e.g. Data Structures and Algorithms" class="w-full" autofocus />
          </UFormField>

          <div>
            <p class="field-label mb-3">Certificate template</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                v-for="tpl in TEMPLATES"
                :key="tpl.value"
                type="button"
                class="modal-template-card"
                :class="{ 'modal-template-card--active': newCourseTemplate === tpl.value }"
                :aria-label="`${tpl.label} template — ${tpl.description}`"
                :aria-pressed="newCourseTemplate === tpl.value"
                @click="newCourseTemplate = tpl.value"
              >
                <span class="modal-template-preview">
                  <img :src="`/certificate-templates/${tpl.value}.png`" :alt="`${tpl.label} template preview`" class="modal-template-preview-image" loading="lazy" />
                  <span v-if="newCourseTemplate === tpl.value" class="modal-template-check">
                    <UIcon name="i-heroicons-check" class="size-3" />
                  </span>
                </span>
                <span class="modal-template-name">{{ tpl.label }}</span>
                <span class="modal-template-tag">{{ tpl.tag }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="outline" color="neutral" @click="createModalOpen = false">Cancel</UButton>
          <UButton :loading="creating" :disabled="!newCourseName.trim()" @click="onCreateCourse">Add course</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.page-title { color: var(--text-primary); }
.page-subtitle { color: var(--text-secondary); }
.text-link { color: var(--accent); text-decoration: underline; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 16px;
}
.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--surface-hover);
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.course-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}

.course-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
}

.course-preview {
  flex-shrink: 0;
  width: 64px;
  aspect-ratio: 1600 / 620;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-hover);
}
.course-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}

.course-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.course-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-template-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.course-chevron {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}
.course-chevron--open {
  transform: rotate(180deg);
}

.template-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 14px 16px;
  border-top: 1px solid var(--border);
}

.template-card {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}
.template-card:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (max-width: 640px) {
  .template-card {
    flex-direction: column;
    align-items: stretch;
  }
}

.template-card:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.template-card--active {
  border-color: var(--accent);
}

/*
 * Real renders of each template (frontend/public/certificate-templates/),
 * generated once from the actual template functions with sample data — not
 * an abstract mockup. Cropped to the top ~40% of the 1600x1131 certificate,
 * since that's where every template's distinguishing content lives.
 */
.template-preview {
  flex-shrink: 0;
  width: 340px;
  aspect-ratio: 1600 / 620;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-hover);
}

.template-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.template-desc {
  font-size: 13px;
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .template-preview {
    width: 100%;
  }
}

/*
 * "New course" modal's template picker — deliberately separate classes from
 * .template-card/.template-preview above, which stay as-is for the inline
 * per-course row picker. A grid of larger, full-bleed (uncropped) previews
 * so all 3 templates are comparable at a glance, no scrolling.
 */
.modal-template-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 10px 12px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}
.modal-template-card:hover {
  border-color: var(--border-strong);
}
.modal-template-card--active {
  border-color: var(--accent);
  background: var(--accent-light);
  box-shadow: 0 0 0 1px var(--accent);
}

.modal-template-preview {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1600 / 1131;
  border-radius: 7px;
  overflow: hidden;
  background: var(--surface-hover);
  box-shadow: var(--shadow-card);
  margin-bottom: 10px;
}
.modal-template-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.modal-template-check {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--surface);
}

.modal-template-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-template-tag {
  font-size: 11.5px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
</style>
