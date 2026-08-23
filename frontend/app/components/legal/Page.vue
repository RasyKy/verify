<script setup lang="ts">
/**
 * Shared shell for the prose pages (terms, privacy).
 *
 * These are long-form documents rather than product surfaces, so they get one
 * narrow measure and one set of type rules defined here — three pages each
 * hand-rolling their own heading sizes is how they drift apart.
 */
defineProps<{
  title: string
  /** ISO date the document last changed. Rendered long-form. */
  updated: string
  lead?: string
}>()
</script>

<template>
  <article class="legal">
    <header class="legal-head">
      <NuxtLink to="/" class="crumb">
        <UIcon name="i-heroicons-arrow-left" class="crumb-icon" />
        Home
      </NuxtLink>
      <h1 class="legal-title">{{ title }}</h1>
      <p class="legal-updated">
        Last updated
        {{ new Date(updated).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        }) }}
      </p>
      <p v-if="lead" class="legal-lead">{{ lead }}</p>
    </header>

    <div class="legal-body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.legal {
  max-width: 760px;
  margin: 0 auto;
  padding: 56px 24px 96px;
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 28px;
  transition: color var(--transition-fast);
}

.crumb:hover { color: var(--accent-text); }

.crumb-icon { width: 14px; height: 14px; }

.legal-title {
  font-size: clamp(30px, 4.5vw, 40px);
  font-weight: 700;
  letter-spacing: -0.028em;
  line-height: 1.12;
  color: var(--text-primary);
  margin: 0;
}

.legal-updated {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 12px 0 0;
}

.legal-lead {
  font-size: 16.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 22px 0 0;
}

.legal-head {
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border);
}

/* Deep selectors: the content is a slot, so it carries the parent page's
   scope id, not this component's. */
.legal-body {
  margin-top: 40px;
}

.legal-body :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--text-primary);
  margin: 44px 0 12px;
}

.legal-body :deep(h2:first-child) {
  margin-top: 0;
}

.legal-body :deep(h3) {
  font-size: 15.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 26px 0 8px;
}

.legal-body :deep(p) {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

/* Tailwind's preflight strips list markers globally, so they have to be asked
   for again — without this every clause reads as an unindented paragraph. */
/* Block, not flex. A flex container turns its `li` children into flex items,
   and several engines then drop the ::marker entirely — so the gap comes from
   margins on the items instead. */
.legal-body :deep(ul),
.legal-body :deep(ol) {
  margin: 0 0 16px;
  padding-left: 24px;
}

.legal-body :deep(li + li) {
  margin-top: 9px;
}

.legal-body :deep(ul) { list-style: disc outside; }
.legal-body :deep(ol) { list-style: decimal outside; }

.legal-body :deep(li)::marker {
  color: var(--text-tertiary);
}

.legal-body :deep(li) {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.legal-body :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.legal-body :deep(a) {
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.legal-body :deep(code) {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 13px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 5px;
}

/* Pulled-out clarification, for the points people actually get wrong. */
.legal-body :deep(.note) {
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 16px 18px;
  margin: 0 0 20px;
}

.legal-body :deep(.note p) {
  margin: 0;
  font-size: 14px;
}

.legal-body :deep(.note p + p) {
  margin-top: 10px;
}

@media (max-width: 640px) {
  .legal {
    padding: 36px 20px 72px;
  }
}
</style>
