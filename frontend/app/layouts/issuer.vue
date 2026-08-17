<script setup lang="ts">
// The organization comes from GET /api/auth/me, not from
// user_metadata.institution_name — that field is writable by the user through
// auth.updateUser(), so it is fine as a display label but must never be the
// source of truth for which institution this issuer represents.
const me = useMe()
await fetchMe()

const institutionName = computed(() => me.value?.organization?.name ?? '')

const issueModalOpen = useState<boolean>('issue-modal', () => false)
const certsRefreshKey = useState<number>('certs-refresh', () => 0)

const nav = [
  { label: 'Dashboard', icon: 'i-heroicons-squares-2x2', to: '/issuer' },
  { label: 'Certificates', icon: 'i-heroicons-document-text', to: '/issuer/certificates' },
]

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  clearMe()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside class="w-55 shrink-0 flex flex-col border-r sidebar">
      <!-- Logo + institution name -->
      <div class="px-4 pt-6 pb-5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 logo-badge">
            <span class="text-white font-bold text-sm leading-none">V</span>
          </div>
          <span class="font-semibold text-sm wordmark">Verify</span>
        </div>
        <p v-if="institutionName" class="text-xs mt-1.5 pl-10.5 truncate institution-name">
          {{ institutionName }}
        </p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 space-y-0.5">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          custom
          v-slot="{ isExactActive, navigate }"
        >
          <button
            class="nav-item flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left"
            :class="isExactActive ? 'nav-item--active' : ''"
            @click="navigate"
          >
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            {{ item.label }}
          </button>
        </NuxtLink>

        <!-- Issue certificate — action button, not a route -->
        <button
          class="nav-item nav-item--action flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left mt-1"
          @click="issueModalOpen = true"
        >
          <UIcon name="i-heroicons-plus-circle" class="size-4 shrink-0" />
          Issue certificate
        </button>
      </nav>

      <!-- Logout -->
      <div class="px-3 pb-4 pt-3 sidebar-footer">
        <button
          class="nav-item flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left"
          @click="logout"
        >
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="size-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-10 main-canvas">
      <slot />
    </main>

    <!-- Global issue modal — triggered by sidebar or any page via useState -->
    <IssuerCertificateModal
      v-model:open="issueModalOpen"
      @success="certsRefreshKey++"
    />
  </div>
</template>

<style scoped>
.sidebar {
  background: var(--canvas);
  border-color: var(--border);
}

.logo-badge {
  background: var(--accent);
}

.wordmark {
  color: var(--text-primary);
}

.institution-name {
  color: var(--text-tertiary);
}

.main-canvas {
  background: var(--canvas);
}

.sidebar-footer {
  border-top: 1px solid var(--border);
}

.nav-item {
  color: var(--text-secondary);
  transition: background-color 0.1s ease;
}

.nav-item:hover {
  background: var(--surface-hover);
}

.nav-item--active {
  background: var(--accent-light);
  color: var(--accent-text);
}

.nav-item--active:hover {
  background: var(--accent-light);
}

.nav-item--action {
  color: var(--accent-text);
}

.nav-item--action:hover {
  background: var(--accent-light);
}
</style>
