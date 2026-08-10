<script setup lang="ts">
// No route guard here yet: there's no admin login flow (CLAUDE.md lists
// admin scope as TBD), so this portal is intentionally left reachable
// without auth for now. See app/middleware/auth.global.ts.

const menuOpen = ref(false)

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const nav = [
  { label: 'Overview',      icon: 'i-heroicons-squares-2x2',              to: '/admin',               exact: true  },
  { label: 'Organizations', icon: 'i-heroicons-building-office-2',        to: '/admin/organizations', exact: false },
  { label: 'Users',         icon: 'i-heroicons-users',                    to: '/admin/users',         exact: true  },
  { label: 'Certificates',  icon: 'i-heroicons-document-text',            to: '/admin/certificates',  exact: true  },
  { label: 'Audit log',     icon: 'i-heroicons-clipboard-document-list',  to: '/admin/audit',         exact: true  },
]

const route = useRoute()

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
        <div class="logo-badge">
          <span>V</span>
        </div>
        <div>
          <span class="wordmark">Verify</span>
          <span class="portal-label">Admin</span>
        </div>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
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
            <UIcon :name="item.icon" class="nav-icon" />
            {{ item.label }}
          </button>
        </NuxtLink>
      </nav>

      <!-- Admin user placeholder -->
      <div class="sidebar-footer">
        <div class="admin-user">
          <div class="admin-avatar">RK</div>
          <div class="admin-user-info">
            <span class="admin-user-name">Rasy K</span>
            <span class="admin-user-email">rasy@verify.app</span>
          </div>
        </div>
        <button class="nav-item logout-item" @click="logout">
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
        <span class="mobile-wordmark">Verify Admin</span>
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
  background: var(--canvas);
}

/* ── Sidebar ── */
.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--canvas);
  transition: transform 0.25s ease;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 16px 20px;
}

.logo-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-badge span {
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
}

.wordmark {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.portal-label {
  display: block;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1;
}

.sidebar-nav {
  flex: 1;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  text-align: left;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
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

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Sidebar footer ── */
.sidebar-footer {
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border);
}

.admin-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent-text);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-user-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
}

.admin-user-email {
  display: block;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.2;
}

.logout-item {
  margin-top: 10px;
  width: 100%;
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
  padding: 40px;
  background: var(--canvas);
}

/* ── Mobile ── */
.mobile-topbar {
  display: none;
}

.mobile-backdrop {
  display: none;
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

  .mobile-wordmark {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
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
