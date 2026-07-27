<script setup lang="ts">
const { recipient } = useRecipientMockData()

const nav = [
  { label: 'My Certificates', icon: 'i-heroicons-academic-cap', to: '/recipient' },
]

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <aside class="w-55 shrink-0 flex flex-col border-r sidebar">
      <!-- Logo + recipient name -->
      <div class="px-4 pt-6 pb-5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 logo-badge">
            <span class="text-white font-bold text-sm leading-none">V</span>
          </div>
          <span class="font-semibold text-sm wordmark">Verify</span>
        </div>
        <p v-if="recipient.name" class="text-xs mt-1.5 pl-10.5 truncate recipient-subtitle">
          {{ recipient.name }}
        </p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 space-y-0.5">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" custom v-slot="{ isExactActive, navigate }">
          <button
            class="nav-item flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left"
            :class="isExactActive ? 'nav-item--active' : ''"
            @click="navigate"
          >
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            {{ item.label }}
          </button>
        </NuxtLink>
      </nav>

      <!-- Logout -->
      <div class="px-3 pb-4 pt-3 sidebar-footer">
        <button class="nav-item flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left" @click="logout">
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="size-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-10 main-canvas">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.sidebar { background: var(--canvas); border-color: var(--border); }
.logo-badge { background: var(--accent); }
.wordmark { color: var(--text-primary); }
.recipient-subtitle { color: var(--text-tertiary); }
.main-canvas { background: var(--canvas); }
.sidebar-footer { border-top: 1px solid var(--border); }
.nav-item { color: var(--text-secondary); transition: background-color 0.1s ease; }
.nav-item:hover { background: var(--surface-hover); }
.nav-item--active { background: var(--accent-light); color: var(--accent-text); }
.nav-item--active:hover { background: var(--accent-light); }
</style>
