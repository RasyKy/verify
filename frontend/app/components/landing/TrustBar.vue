<template>
  <section v-if="institutions?.length" class="trust-bar reveal">
    <div class="trust-inner">
      <p class="trust-label">Trusted by institutions worldwide</p>
      <div class="trust-logos">
        <div v-for="org in institutions" :key="org.id" :title="org.name" class="trust-item">
          <span class="trust-logo">{{ acronymOf(org.name) }}</span>
          <span class="trust-meta">{{ typeLabel(org.type) }} · {{ joinedLabel(org.joinedAt) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { institutions } = useRegistry()

// Institutions only have a full `name` in the schema — no stored short form —
// so derive a compact acronym for this bar's existing badge-style look.
// Small connector words are skipped so e.g. "Delta Polytechnic" -> "DP", not "DPO".
const STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'le', 'des', 'du'])

function acronymOf(name: string) {
  const initials = name
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase()

  if (initials.length >= 2) return initials.slice(0, 6)
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || name.slice(0, 4)
}

const TYPE_LABELS: Record<string, string> = {
  university: 'University',
  bootcamp: 'Bootcamp',
  'professional-body': 'Professional body',
  event: 'Event',
}

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type
}

function joinedLabel(joinedAt: string) {
  return new Date(joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.trust-bar {
  background: var(--surface-hover);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 28px 40px;
}

.trust-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.trust-label {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
  letter-spacing: 0.02em;
}

.trust-logos {
  display: flex;
  align-items: center;
  gap: 32px;
  flex-wrap: wrap;
  justify-content: center;
}

.trust-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 0.1s ease;
}

.trust-item:hover {
  border-color: var(--text-tertiary);
}

.trust-logo {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  font-family: ui-monospace, 'Cascadia Code', monospace;
}

.trust-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .trust-bar {
    padding: 24px 20px;
  }
  .trust-logos {
    gap: 12px;
  }
}
</style>
