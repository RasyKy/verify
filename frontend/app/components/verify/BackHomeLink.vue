<script setup lang="ts">
/**
 * Way out of the standalone verification pages.
 *
 * Those pages render with `layout: false`, so they have no header to escape
 * through — and the people on them typically arrived by scanning a QR code or
 * following a shared link, meaning `history.back()` has nowhere to go. A plain
 * link to `/` is the only exit that always works.
 */
</script>

<template>
  <NuxtLink to="/" class="back-link">
    <UIcon name="i-heroicons-arrow-left" class="back-icon" />
    <span>Back to home</span>
  </NuxtLink>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  transition: border-color 150ms ease, color 150ms ease;
}

.back-link:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}

.back-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.back-icon {
  width: 15px;
  height: 15px;
  transition: transform 150ms ease;
}

.back-link:hover .back-icon {
  transform: translateX(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .back-link:hover .back-icon {
    transform: none;
  }
}
</style>
