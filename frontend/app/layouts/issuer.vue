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
  { label: 'Courses', icon: 'i-heroicons-academic-cap', to: '/issuer/courses' },
  { label: 'Settings', icon: 'i-heroicons-cog-6-tooth', to: '/issuer/settings' },
]

async function logout() {
  const supabase = useSupabaseClient()
  await supabase.auth.signOut()
  // Drop the cached profile too, or the next person to sign in on this tab
  // inherits the previous user's role until the state is rebuilt.
  clearMe()
  await navigateTo('/login')
}
</script>

<template>
  <div class="issuer-shell">
    <aside class="rail">
      <!-- Brand block -->
      <div class="rail-brand">
        <BrandLogo :size="34" tone="mono" wordmark label="Issuer" />
        <p v-if="institutionName" class="rail-institution">
          {{ institutionName }}
        </p>
      </div>

      <nav class="rail-nav">
        <p class="rail-section">Menu</p>
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          custom
          v-slot="{ isExactActive, navigate }"
        >
          <button
            class="rail-item"
            :class="{ 'rail-item--active': isExactActive }"
            @click="navigate"
          >
            <span class="rail-marker" aria-hidden="true" />
            <UIcon :name="item.icon" class="rail-icon" />
            {{ item.label }}
          </button>
        </NuxtLink>
      </nav>

      <div class="rail-footer">
        <button class="rail-item rail-item--quiet" @click="logout">
          <span class="rail-marker" aria-hidden="true" />
          <UIcon name="i-heroicons-arrow-right-on-rectangle" class="rail-icon" />
          Log out
        </button>
      </div>
    </aside>

    <!-- Page content -->
    <main class="issuer-main">
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
.issuer-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--canvas-app);
}

/* ── Rail ── */
.rail {
  width: 236px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--rail-bg);
  background-image: linear-gradient(180deg, var(--rail-bg-soft) 0%, var(--rail-bg) 45%);
  color: var(--rail-text);
}

.rail-brand {
  padding: 22px 18px 18px;
  color: var(--rail-text-strong);
  border-bottom: 1px solid var(--rail-border);
}

.rail-institution {
  font-size: 11.5px;
  color: var(--rail-text-dim);
  margin: 10px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Primary action ── */
.rail-action-wrap {
  padding: 16px 14px 6px;
}

.rail-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: #fff;
  color: var(--accent-text);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.5);
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.rail-action:hover {
  background: var(--accent-light);
  transform: translateY(-1px);
}

.rail-action:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.rail-action-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* ── Nav ── */
.rail-nav {
  flex: 1;
  padding: 18px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.rail-section {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--rail-text-dim);
  margin: 0 0 8px;
  padding-left: 12px;
}

.rail-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--rail-text);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.rail-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--rail-text-strong);
}

.rail-item--active {
  background: var(--rail-active-bg);
  color: var(--rail-text-strong);
  font-weight: 600;
}

.rail-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: -2px;
}

/* Left edge marker — grows in on the active item only */
.rail-marker {
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

.rail-item--active .rail-marker {
  height: 20px;
}

.rail-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

.rail-item--quiet {
  color: var(--rail-text-dim);
}

/* ── Footer ── */
.rail-footer {
  padding: 12px 14px 16px;
  border-top: 1px solid var(--rail-border);
}

/* ── Main ── */
.issuer-main {
  flex: 1;
  overflow-y: auto;
  padding: 34px 38px 48px;
  background: var(--canvas-app);
}

@media (prefers-reduced-motion: reduce) {
  .rail-action:hover { transform: none; }
  .rail-marker { transition: none; }
}

@media (max-width: 900px) {
  .rail {
    width: 74px;
  }

  /* Collapsed rail: the mark and the icons carry it */
  .rail :deep(.brand-text),
  .rail-institution,
  .rail-section,
  .rail-action,
  .rail-item {
    font-size: 0;
  }

  .rail-brand {
    padding: 20px 0;
    display: flex;
    justify-content: center;
  }

  .rail-institution,
  .rail-section {
    display: none;
  }

  .rail-item,
  .rail-action {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  .issuer-main {
    padding: 24px 18px 36px;
  }
}
</style>
