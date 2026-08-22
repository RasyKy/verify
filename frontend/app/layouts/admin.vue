<script setup lang="ts">
// Guarded by app/middleware/auth.global.ts, which requires the `admin` role
// (read from the backend, not the JWT) before this layout renders.

const menuOpen = ref(false)

// Resolved during setup — see the note in layouts/issuer.vue.
const currentUser = useCurrentUser()

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  currentUser.value = null
  await navigateTo('/login?redirect=/admin')
}

const nav = [
  { label: 'Overview',      icon: 'i-heroicons-squares-2x2',              to: '/admin',               exact: true  },
  { label: 'Organizations', icon: 'i-heroicons-building-office-2',        to: '/admin/organizations', exact: false },
  { label: 'Users',         icon: 'i-heroicons-users',                    to: '/admin/users',         exact: true  },
  { label: 'Certificates',  icon: 'i-heroicons-document-text',            to: '/admin/certificates',  exact: true  },
  { label: 'Audit log',     icon: 'i-heroicons-clipboard-document-list',  to: '/admin/audit',         exact: true  },
]

const route = useRoute()

/*
 * The footer identity. GET /api/auth/me returns no display name, so the name
 * comes from Supabase's user_metadata (set at sign-up) and the email — which
 * is authoritative — comes from the backend profile.
 */
const supabaseUser = useSupabaseUser()

const adminEmail = computed(
  () => currentUser.value?.email ?? supabaseUser.value?.email ?? '',
)

const adminName = computed(() => {
  const meta = supabaseUser.value?.user_metadata?.full_name
  if (typeof meta === 'string' && meta.trim()) return meta.trim()
  return 'Administrator'
})

/** Two initials from the name, falling back to the email's first letters. */
const adminInitials = computed(() => {
  const source =
    adminName.value === 'Administrator' ? adminEmail.value : adminName.value
  const parts = source.split(/[\s._@-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) || 'AD').toUpperCase()
})

function isActive(item: typeof nav[number]) {
  return item.exact
    ? route.path === item.to
    : route.path.startsWith(item.to)
}
</script>

<template>
  <div class="admin-shell">
    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div v-if="menuOpen" class="mobile-backdrop" @click="menuOpen = false" />
    </Transition>

    <!-- Sidebar -->
    <aside class="admin-sidebar" :class="{ 'admin-sidebar--open': menuOpen }">
      <!-- Logo -->
      <div class="sidebar-logo">
        <BrandLogo :size="34" tone="mono" wordmark label="Admin" />
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        <p class="nav-section">Manage</p>
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          custom
          v-slot="{ navigate }"
        >
          <button
            class="nav-item"
            :class="{ 'nav-item--active': isActive(item) }"
            @click="navigate(); menuOpen = false"
          >
            <span class="nav-marker" aria-hidden="true" />
            <UIcon :name="item.icon" class="nav-icon" />
            {{ item.label }}
          </button>
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-user">
          <div class="admin-avatar">{{ adminInitials }}</div>
          <div class="admin-user-info">
            <span class="admin-user-name">{{ adminName }}</span>
            <span v-if="adminEmail" class="admin-user-email">{{ adminEmail }}</span>
          </div>
        </div>
        <button class="nav-item logout-item" @click="logout">
          <span class="nav-marker" aria-hidden="true" />
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="nav-icon" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="admin-body">
      <!-- Mobile top bar -->
      <div class="mobile-topbar">
        <button class="hamburger" @click="menuOpen = true" aria-label="Open menu">
          <UIcon name="i-heroicons-bars-3" class="size-5" />
        </button>
        <BrandLogo :size="26" wordmark label="Admin" />
      </div>

      <main class="admin-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--canvas-app);
}

/* ── Sidebar ── */
.admin-sidebar {
  width: 236px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--rail-bg);
  background-image: linear-gradient(180deg, var(--rail-bg-soft) 0%, var(--rail-bg) 45%);
  color: var(--rail-text);
  transition: transform 0.25s ease;
}

.sidebar-logo {
  padding: 22px 18px 18px;
  color: var(--rail-text-strong);
  border-bottom: 1px solid var(--rail-border);
}

.sidebar-nav {
  flex: 1;
  padding: 18px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-section {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--rail-text-dim);
  margin: 0 0 8px;
  padding-left: 12px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 9px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  color: var(--rail-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--rail-text-strong);
}

.nav-item--active {
  background: var(--rail-active-bg);
  color: var(--rail-text-strong);
  font-weight: 600;
}

.nav-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: -2px;
}

/* Left edge marker — grows in on the active item only */
.nav-marker {
  position: absolute;
  left: -14px;
  top: 50%;
  width: 3px;
  height: 0;
  border-radius: 0 3px 3px 0;
  background: #7FD3C5;
  transform: translateY(-50%);
  transition: height var(--transition-base);
}

.nav-item--active .nav-marker {
  height: 20px;
}

.nav-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

/* ── Sidebar footer ── */
.sidebar-footer {
  padding: 12px 14px 16px;
  border-top: 1px solid var(--rail-border);
}

.admin-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 4px;
}

.admin-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: var(--rail-text-strong);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-user-info {
  min-width: 0;
}

.admin-user-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--rail-text-strong);
  line-height: 1.3;
}

.admin-user-email {
  display: block;
  font-size: 11px;
  color: var(--rail-text-dim);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-item {
  margin-top: 10px;
  width: 100%;
  color: var(--rail-text-dim);
}

/* ── Body ── */
.admin-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-main {
  flex: 1;
  overflow-y: auto;
  padding: 34px 38px 48px;
  background: var(--canvas-app);
}

/* ── Mobile ── */
.mobile-topbar {
  display: none;
}

.mobile-backdrop {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .nav-marker {
    transition: none;
  }
}

@media (max-width: 767px) {
  .admin-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 50;
    transform: translateX(-100%);
  }

  .admin-sidebar--open {
    transform: translateX(0);
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 49;
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--canvas);
    position: sticky;
    top: 0;
    z-index: 40;
    flex-shrink: 0;
  }

  .hamburger {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
  }

  .admin-main {
    padding: 24px 16px;
  }
}

/* Transition for backdrop */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
