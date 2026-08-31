<script setup lang="ts">
/**
 * Minimal footer for logged-in portal pages (recipient, and any future portal
 * that wants it) — deliberately not the marketing Footer.vue used on the
 * landing page. Most of a full site footer's links exist for legal/enterprise
 * reasons that don't apply once someone is already signed in; this exists
 * only to stop the page ending in dead space, not to sell anything.
 *
 * Light, matching the page it closes: recipient.vue has no dark rail or
 * banner anywhere else on it, so a dark footer here was one isolated dark
 * block with nothing else on the page to justify it — the same mistake the
 * landing page's footer made and was reverted from. `--canvas-app` is a step
 * warmer/greyer than the page's own `--surface` white, enough to read as its
 * own surface without introducing a new colour.
 *
 * A plain <footer> rather than Nuxt UI's <UFooter>: the only thing that
 * component was contributing here was a border and a container width, not
 * worth pulling in for one row.
 */
</script>

<template>
  <footer class="portal-footer">
    <div class="portal-footer-inner">
      <BrandLogo :size="20" wordmark />

      <nav class="portal-footer-nav">
        <NuxtLink to="/contact" class="portal-footer-link">Contact</NuxtLink>
        <NuxtLink to="/privacy" class="portal-footer-link">Privacy</NuxtLink>
        <NuxtLink to="/terms" class="portal-footer-link">Terms</NuxtLink>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.portal-footer {
  background: var(--canvas-app);
  border-top: 1px solid var(--border);
  /* BrandLogo's wordmark inherits colour — set it here, not inside the mark. */
  color: var(--text-primary);
  padding: 22px 40px;
}

.portal-footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.portal-footer-nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

.portal-footer-link {
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.portal-footer-link:hover {
  color: var(--accent-text);
}

@media (max-width: 640px) {
  .portal-footer {
    padding: 20px;
  }

  .portal-footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
</style>
