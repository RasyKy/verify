<script setup lang="ts">
/**
 * Minimal footer for logged-in portal pages (recipient, and any future portal
 * that wants it) — deliberately not the marketing Footer.vue used on the
 * landing page. Most of a full site footer's links exist for legal/enterprise
 * reasons that don't apply once someone is already signed in; this exists
 * only to stop the page ending in dead space, not to sell anything.
 */
</script>

<template>
  <UFooter :ui="{ root: 'border-t border-gray-200', container: 'max-w-content py-6' }">
    <template #left>
      <BrandLogo :size="18" tone="mono" wordmark class="opacity-60" />
    </template>
    <template #right>
      <nav class="flex items-center gap-4 text-xs text-gray-400">
        <NuxtLink to="/contact" class="hover:text-gray-600 transition-colors">Contact</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-gray-600 transition-colors">Privacy</NuxtLink>
        <NuxtLink to="/terms" class="hover:text-gray-600 transition-colors">Terms</NuxtLink>
      </nav>
    </template>
  </UFooter>
</template>
