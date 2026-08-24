<script setup lang="ts">
import type { PublicProfileCertificate } from '~/composables/usePublicProfile'

/**
 * One certificate on a holder's public profile.
 *
 * Deliberately not RecipientCertificateCard with the toggle hidden: that card
 * carries a visibility control and an emit-based detail modal, neither of which
 * a stranger can use. Here the whole card is a link to the certificate's public
 * page, because opening it is the only thing a visitor came to do.
 */
defineProps<{ cert: PublicProfileCertificate }>()

const statusConfig: Record<'valid' | 'revoked' | 'expired', { label: string; style: string }> = {
  valid: { label: 'Valid', style: 'background: var(--status-valid-bg); color: var(--status-valid-text)' },
  revoked: { label: 'Revoked', style: 'background: var(--status-revoked-bg); color: var(--status-revoked-text)' },
  expired: { label: 'Expired', style: 'background: var(--status-expired-bg); color: var(--status-expired-text)' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <NuxtLink :to="`/cert/${cert.id}`" class="cert-card p-5 rounded-xl flex flex-col gap-3">
    <div class="flex items-start justify-between gap-2">
      <div class="badge-icon shrink-0">
        <UIcon name="i-heroicons-academic-cap" class="size-5" />
      </div>
      <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" :style="statusConfig[cert.status].style">
        {{ statusConfig[cert.status].label }}
      </span>
    </div>

    <div class="min-w-0">
      <p class="text-sm font-semibold truncate card-title">{{ cert.course_name }}</p>
      <p class="text-xs truncate card-subtitle">{{ cert.institution_name }}</p>
    </div>

    <div class="text-xs card-meta space-y-0.5">
      <p>Issued {{ formatDate(cert.issued_at) }}</p>
      <p v-if="cert.expiry_date">Expires {{ formatDate(cert.expiry_date) }}</p>
    </div>

    <div class="flex items-center justify-between pt-3 card-footer">
      <span class="text-xs card-meta">Blockchain-backed</span>
      <span class="verify-cue text-sm font-medium">
        Verify
        <UIcon name="i-heroicons-arrow-right" class="size-4" />
      </span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.cert-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-panel);
  text-decoration: none;
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}
.cert-card:hover {
  box-shadow: var(--shadow-panel-hover);
  transform: translateY(-2px);
}

.badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent);
}

.card-title { color: var(--text-primary); }
.card-subtitle { color: var(--text-secondary); }
.card-meta { color: var(--text-tertiary); }
.card-footer { border-top: 1px solid var(--border); }

.verify-cue {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent-text);
}
</style>
