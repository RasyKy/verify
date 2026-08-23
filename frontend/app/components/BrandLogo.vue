<script setup lang="ts">
/**
 * The Verify mark.
 *
 * Two pieces of artwork, one per ground:
 *
 *   brand → /logo.png, the full-colour mark, for light surfaces.
 *   mono  → /verify_icon_inverted_for_green.svg, drawn white-on-transparent
 *           with a green check, for the dark green rails and panels.
 *
 * The inverted file exists precisely so the mark can sit directly on green.
 * An earlier version boxed the colour PNG on a white chip to force contrast,
 * which read as a border around the logo rather than as the logo.
 */
withDefaults(
  defineProps<{
    /** Rendered mark size in px. */
    size?: number
    /** Show the "Verify" wordmark beside the mark. */
    wordmark?: boolean
    /** Wordmark subtitle, e.g. "Admin" or "Issuer portal". */
    label?: string
    /** `brand` = mark as-is; `mono` = light chip + inherited text, for dark surfaces. */
    tone?: 'brand' | 'mono'
    /**
     * Center the mark as a block-level element, for the auth cards that stack
     * it above a heading.
     *
     * This lives here rather than at the call site because the root of this
     * component is `inline-flex`, and a parent overriding that from its own
     * scoped stylesheet is a coin toss: `.brand` and the parent's class carry
     * equal specificity, so which `display` wins comes down to which
     * component's CSS the bundler emits last. When `inline-flex` wins, the
     * span shrinks to its content and the parent's `justify-content` has
     * nothing left to center — the mark quietly sits at the card's left edge.
     */
    center?: boolean
  }>(),
  { size: 32, wordmark: false, label: '', tone: 'brand', center: false },
)
</script>

<template>
  <span class="brand" :class="[`brand--${tone}`, { 'brand--center': center }]">
    <span class="mark-frame" :style="{ '--mark': `${size}px` }">
      <img
        :src="tone === 'mono' ? '/verify_icon_inverted_for_green.svg' : '/logo.png'"
        alt=""
        class="mark-img"
        decoding="async"
      />
    </span>

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

/* Declared after `.brand` in the same scoped sheet, so it always wins the
   `display` it needs — the whole point of centering from inside. */
.brand--center {
  display: flex;
  width: 100%;
  justify-content: center;
}

.mark-frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--mark);
  height: var(--mark);
  flex-shrink: 0;
}

.mark-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* No chip, no padding: the inverted artwork already carries its own contrast. */

/* ── Wordmark ── */
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.brand-word {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.03em;
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
