<template>
  <section v-if="institutions?.length" class="trust-bar reveal">
    <div class="trust-inner">
      <p class="trust-label">Trusted by institutions worldwide</p>
      <div class="trust-logos">
        <span
          v-for="org in institutions"
          :key="org.id"
          :title="org.name"
          class="trust-logo"
        >
          {{ acronymOf(org.name) }}
        </span>
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

.trust-logo {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  font-family: ui-monospace, 'Cascadia Code', monospace;
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface);
  transition: color 0.1s ease;
}

.trust-logo:hover {
  color: var(--text-secondary);
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
