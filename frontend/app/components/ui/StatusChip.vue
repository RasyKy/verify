<script setup lang="ts">
/**
 * Certificate status only (valid/revoked/expired) — DESIGN.md requires status
 * color to live in exactly one component. `admin/StatusChip.vue` is a
 * separate, broader concept (org/user/entity status) and is left alone.
 */
const props = defineProps<{ status: 'valid' | 'revoked' | 'expired' }>()

const config: Record<typeof props.status, { label: string; style: string }> = {
  valid: { label: 'Valid', style: 'background: var(--status-valid-bg); color: var(--status-valid-text)' },
  revoked: { label: 'Revoked', style: 'background: var(--status-revoked-bg); color: var(--status-revoked-text)' },
  expired: { label: 'Expired', style: 'background: var(--status-expired-bg); color: var(--status-expired-text)' },
}
</script>

<template>
  <span class="inline-block text-xs font-medium px-2 py-0.5 rounded-full" :style="config[status].style">
    {{ config[status].label }}
  </span>
</template>
