<script setup lang="ts">
// Identity comes from the backend; the certificate list is still mock data
// until Phase 4 wires GET /api/holder/certificates.
const me = useMe()
await fetchMe()

const recipientName = computed(() => displayName(me.value))

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  // Drop the cached profile too, or the next person to sign in on this tab
  // inherits the previous user's role until the state is rebuilt.
  clearMe()
  await navigateTo('/login?redirect=/recipient')
}
</script>

<template>
  <div class="profile-shell">
    <header class="top-bar">
      <div class="top-bar-inner">
        <NuxtLink to="/recipient" class="logo-link" aria-label="Verify — my certificates">
          <BrandLogo :size="30" wordmark />
        </NuxtLink>

        <div class="top-bar-right">
          <span v-if="recipientName" class="recipient-name">{{ recipientName }}</span>
          <button class="logout-btn" aria-label="Log out" title="Log out" @click="logout">
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="size-4" />
          </button>
        </div>
      </div>
    </header>

    <main class="page-canvas">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.profile-shell {
  min-height: 100vh;
  background: var(--canvas-app);
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: saturate(160%) blur(12px);
  border-bottom: 1px solid var(--border);
}

.top-bar-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 40px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recipient-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-tertiary);
  transition: background-color 0.1s ease, color 0.1s ease;
}

.logout-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.page-canvas {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 40px 80px;
}

@media (max-width: 640px) {
  .top-bar-inner,
  .page-canvas {
    padding-left: 20px;
    padding-right: 20px;
  }
}
</style>
