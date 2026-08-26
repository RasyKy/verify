<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

const props = defineProps<{ cert: HolderCertificate }>()
const emit = defineEmits<{ view: [id: string]; 'toggle-hidden': [id: string, isHidden: boolean] }>()

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const dateLine = computed(() => {
  const issued = `Issued ${formatDate(props.cert.issued_at)}`
  return props.cert.expiry_date ? `${issued} · Expires ${formatDate(props.cert.expiry_date)}` : issued
})
</script>

<template>
  <div class="cert-card p-5 rounded-xl flex flex-col gap-3">
    <div class="flex items-start justify-between gap-2">
      <UAvatar
        icon="i-heroicons-academic-cap"
        class="size-9 shrink-0"
        style="background: var(--accent-light); color: var(--accent)"
      />
      <UiStatusChip :status="cert.status" class="shrink-0" />
    </div>

    <div class="min-w-0">
      <p class="text-sm font-semibold truncate card-title">{{ cert.course_name }}</p>
      <p class="text-xs truncate card-subtitle">{{ cert.institution_name }}</p>
    </div>

    <p class="text-xs card-meta">{{ dateLine }}</p>

    <div class="flex items-center justify-between pt-3 card-footer">
      <USwitch
        :model-value="!cert.is_hidden"
        :label="cert.is_hidden ? 'Hidden' : 'Public'"
        size="sm"
        @update:model-value="(isPublic) => emit('toggle-hidden', cert.id, !isPublic)"
      />
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        trailing-icon="i-heroicons-arrow-right"
        @click="emit('view', cert.id)"
      >
        View details
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.cert-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-panel);
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}
.cert-card:hover {
  box-shadow: var(--shadow-panel-hover);
  transform: translateY(-2px);
}
.card-title { color: var(--text-primary); }
.card-subtitle { color: var(--text-secondary); }
.card-meta { color: var(--text-tertiary); }
.card-footer { border-top: 1px solid var(--border); }
</style>
