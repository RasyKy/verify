<script setup lang="ts">
import {
  apiErrorMessage,
  removeCourseBadge,
  uploadCourseBadge,
  useCoursesFull,
  type CourseWithBadge,
} from '~/composables/useCertificates'

definePageMeta({ layout: 'issuer' })

const { courses, pending, refresh, error } = useCoursesFull()
const toast = useToast()

const loadError = computed(() =>
  error.value ? apiErrorMessage(error.value, 'Could not load courses') : null,
)

const MAX_BADGE_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg'])

const busyId = ref<string | null>(null)

async function onUpload(course: CourseWithBadge, file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    toast.add({
      title: 'Unsupported file type',
      description: 'Badges must be a PNG or JPG image.',
      color: 'error',
    })
    return
  }
  if (file.size > MAX_BADGE_BYTES) {
    toast.add({
      title: 'File too large',
      description: 'Badges must be 2MB or smaller.',
      color: 'error',
    })
    return
  }

  busyId.value = course.id
  try {
    await uploadCourseBadge(course.id, file)
    await refresh()
    toast.add({
      title: course.badgeUrl ? 'Badge updated' : 'Badge added',
      description: `${course.name} now shows this badge on every certificate.`,
      color: 'success',
    })
  } catch (err: unknown) {
    toast.add({
      title: 'Could not upload badge',
      description: apiErrorMessage(err, 'Please try again.'),
      color: 'error',
    })
  } finally {
    busyId.value = null
  }
}

async function onRemove(course: CourseWithBadge) {
  busyId.value = course.id
  try {
    await removeCourseBadge(course.id)
    await refresh()
    toast.add({ title: 'Badge removed', color: 'success' })
  } catch (err: unknown) {
    toast.add({
      title: 'Could not remove badge',
      description: apiErrorMessage(err, 'Please try again.'),
      color: 'error',
    })
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold page-title">Courses</h1>
      <p class="text-sm mt-1 page-subtitle">
        Add a badge to a course, and it appears on every certificate issued for it — past and future.
      </p>
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
        Courses are created automatically the first time you issue a certificate for one.
      </p>
    </div>

    <ul v-else class="course-list">
      <li v-for="course in courses" :key="course.id" class="course-row">
        <div class="badge-thumb" :class="{ 'badge-thumb--image': course.badgeUrl }">
          <img v-if="course.badgeUrl" :src="course.badgeUrl" alt="" class="badge-thumb-image" loading="lazy" decoding="async" />
          <UIcon v-else name="i-heroicons-academic-cap" class="size-5" />
        </div>

        <p class="course-name">{{ course.name }}</p>

        <div class="course-actions">
          <UFileUpload
            :model-value="null"
            accept="image/png,image/jpeg"
            variant="button"
            :multiple="false"
            :preview="false"
            :reset="true"
            size="sm"
            color="neutral"
            :label="course.badgeUrl ? 'Replace' : 'Upload badge'"
            icon="i-heroicons-arrow-up-tray"
            :disabled="busyId === course.id"
            @update:model-value="(file) => file && onUpload(course, file as File)"
          />
          <UButton
            v-if="course.badgeUrl"
            variant="ghost"
            color="error"
            size="sm"
            icon="i-heroicons-trash"
            :loading="busyId === course.id"
            aria-label="Remove badge"
            @click="onRemove(course)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page-title { color: var(--text-primary); }
.page-subtitle { color: var(--text-secondary); }

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

.course-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.badge-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge-thumb--image {
  background: radial-gradient(circle, var(--accent-light) 0%, transparent 72%);
}
.badge-thumb-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 999px;
}

.course-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
</style>
