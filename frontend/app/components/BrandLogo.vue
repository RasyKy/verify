<script setup lang="ts">
/**
 * The Verify mark: a document with a check badge whose nodes trail off into a
 * chain — the whole product in one glyph (a credential, checked, anchored).
 *
 * Drawn as inline SVG rather than an <img> so it inherits the surrounding
 * colour. `tone="mono"` paints every stroke in currentColor, which is what the
 * dark sidebar header and any coloured surface need; the default keeps the
 * two-tone brand rendering for light backgrounds.
 */
withDefaults(
  defineProps<{
    /** Rendered mark size in px. */
    size?: number
    /** Show the "Verify" wordmark beside the mark. */
    wordmark?: boolean
    /** Wordmark subtitle, e.g. "Admin" or "Issuer portal". */
    label?: string
    /** `brand` = two-tone; `mono` = everything in currentColor. */
    tone?: 'brand' | 'mono'
  }>(),
  { size: 32, wordmark: false, label: '', tone: 'brand' },
)
</script>

<template>
  <span class="brand" :class="`brand--${tone}`">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Verify"
      class="brand-mark"
    >
      <!-- Document -->
      <rect
        x="9.5" y="5.5" width="35" height="45" rx="5"
        class="mark-doc" stroke-width="3.5"
      />
      <!-- Text lines -->
      <path
        d="M18 16.5h18M18 23h18M18 29.5h11"
        class="mark-lines" stroke-width="3.2" stroke-linecap="round"
      />
      <!-- Chain nodes, trailing off the badge -->
      <path
        d="M35.5 42.5h6.5M35.5 49.5h4.5M39 38.5l3.5-3"
        class="mark-link" stroke-width="2.4" stroke-linecap="round"
      />
      <rect x="42" y="32" width="6.5" height="6.5" rx="1.6" class="mark-node" />
      <rect x="42" y="39.5" width="6.5" height="6.5" rx="1.6" class="mark-node" />
      <rect x="40.5" y="46.5" width="6.5" height="6.5" rx="1.6" class="mark-node" />
      <!-- Check badge — the knockout ring keeps it readable over the document -->
      <circle cx="25" cy="43" r="15.5" class="mark-badge-ring" />
      <circle cx="25" cy="43" r="13" class="mark-badge" />
      <path
        d="M18.5 43.2l4.6 4.6 8.4-9"
        class="mark-check" stroke-width="3.4"
        stroke-linecap="round" stroke-linejoin="round"
      />
    </svg>

    <span v-if="wordmark" class="brand-text">
      <span class="brand-word">Verify</span>
      <span v-if="label" class="brand-label">{{ label }}</span>
    </span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.brand-mark {
  flex-shrink: 0;
}

/* ── Two-tone (default) ── */
.brand--brand .mark-doc     { stroke: var(--text-primary); fill: none; }
.brand--brand .mark-lines   { stroke: #C9D6DF; }
.brand--brand .mark-link    { stroke: var(--accent); }
.brand--brand .mark-node    { fill: var(--accent); }
.brand--brand .mark-badge   { fill: var(--text-primary); }
.brand--brand .mark-check   { stroke: #fff; fill: none; }
.brand--brand .mark-badge-ring { fill: var(--canvas); }

/* ── Mono: for dark or coloured surfaces ── */
.brand--mono .mark-doc     { stroke: currentColor; fill: none; opacity: 0.9; }
.brand--mono .mark-lines   { stroke: currentColor; opacity: 0.4; }
.brand--mono .mark-link    { stroke: currentColor; opacity: 0.75; }
.brand--mono .mark-node    { fill: currentColor; opacity: 0.75; }
.brand--mono .mark-badge   { fill: currentColor; }
.brand--mono .mark-check   { stroke: var(--accent-deep, #0A5C52); fill: none; }
.brand--mono .mark-badge-ring { fill: transparent; }

/* ── Wordmark ── */
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.brand-word {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: inherit;
}

.brand--brand .brand-word {
  color: var(--text-primary);
}

.brand-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.62;
}
</style>
