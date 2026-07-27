<script setup lang="ts">
const props = defineProps<{ status: string }>()

const styleMap: Record<string, { bg: string; text: string }> = {
  issued:      { bg: 'var(--status-valid-bg)',    text: 'var(--status-valid-text)'    },
  active:      { bg: 'var(--status-valid-bg)',    text: 'var(--status-valid-text)'    },
  revoked:     { bg: 'var(--status-revoked-bg)',  text: 'var(--status-revoked-text)'  },
  suspended:   { bg: 'var(--status-revoked-bg)',  text: 'var(--status-revoked-text)'  },
  deactivated: { bg: 'var(--status-revoked-bg)',  text: 'var(--status-revoked-text)'  },
  pending:     { bg: 'var(--status-unclaimed-bg)',text: 'var(--status-unclaimed-text)'},
  unclaimed:   { bg: 'var(--status-unclaimed-bg)',text: 'var(--status-unclaimed-text)'},
  issuer:      { bg: 'var(--tint-blue)',          text: 'var(--tint-blue-icon)'       },
  recipient:   { bg: 'var(--tint-violet)',        text: 'var(--tint-violet-icon)'     },
  university:       { bg: 'var(--tint-blue)',   text: 'var(--tint-blue-icon)'   },
  bootcamp:         { bg: 'var(--tint-green)',  text: 'var(--tint-green-icon)'  },
  'professional-body': { bg: 'var(--tint-amber)',  text: 'var(--tint-amber-icon)'  },
  event:            { bg: 'var(--tint-violet)', text: 'var(--tint-violet-icon)' },
}

const label = computed(() => {
  const map: Record<string, string> = {
    'professional-body': 'Professional body',
  }
  return map[props.status] ?? (props.status.charAt(0).toUpperCase() + props.status.slice(1))
})

const styles = computed(() => styleMap[props.status] ?? { bg: 'var(--surface-hover)', text: 'var(--text-secondary)' })
</script>

<template>
  <span class="chip" :style="`background: ${styles.bg}; color: ${styles.text}`">
    {{ label }}
  </span>
</template>

<style scoped>
.chip {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
</style>
