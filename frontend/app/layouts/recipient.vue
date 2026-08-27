<script setup lang="ts">
// Identity, certificate counts, and profile visibility all live here now —
// this is what backs the header's account dropdown, so every page under this
// layout gets it for free. Fixed-key useAsyncData means calling these here
// AND in pages/recipient/index.vue shares one request/cache, not two.
const me = useMe()
await fetchMe()

const { certificates } = useHolderCertificates()
const { profile, refresh: refreshProfile } = useHolderProfile()

const toast = useToast()
const recipientName = computed(() => displayName(me.value))

const initials = computed(() =>
  recipientName.value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const totalCerts = computed(() => certificates.value.length)
const hiddenCount = computed(() => certificates.value.filter((c) => c.is_hidden).length)
const summaryLine = computed(() => {
  const count = `${totalCerts.value} certificate${totalCerts.value === 1 ? '' : 's'}`
  return hiddenCount.value ? `${count} · ${hiddenCount.value} hidden` : count
})

/**
 * The holder's own public profile URL. Shown here because the visibility
 * toggle below is otherwise unfalsifiable: without a link to the page it
 * governs, "Public"/"Hidden" are claims the holder has no way to check.
 */
const profileUrl = computed(() =>
  me.value ? publicProfileUrl(useRequestURL().origin, me.value.id) : '',
)

const copiedProfileUrl = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyProfileUrl() {
  try {
    await navigator.clipboard.writeText(profileUrl.value)
    copiedProfileUrl.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copiedProfileUrl.value = false), 1600)
  } catch {
    // Clipboard is permission-gated and blocked outside a secure context;
    // the URL is on screen and selectable either way.
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))

async function toggleProfilePublic(isPublic: boolean) {
  try {
    await setProfileVisibility(isPublic)
    toast.add({ title: isPublic ? 'Profile made public' : 'Profile made private', color: 'success' })
    refreshProfile()
  } catch (err) {
    toast.add({ title: 'Could not update profile', description: apiErrorMessage(err), color: 'error' })
  }
}

const menuOpen = ref(false)

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
        <NuxtLink to="/recipient" class="logo-link" aria-label="Verify: my certificates">
          <BrandLogo :size="30" wordmark />
        </NuxtLink>

        <UPopover v-if="recipientName" v-model:open="menuOpen" :content="{ align: 'end' }">
          <button class="account-trigger" aria-label="Account menu">
            <UAvatar :text="initials" class="size-8 shrink-0 account-avatar" />
            <span class="account-name">{{ recipientName }}</span>
            <UIcon
              name="i-heroicons-chevron-down"
              class="size-3.5 account-chevron"
              :class="{ 'account-chevron--open': menuOpen }"
            />
          </button>

          <template #content>
            <div class="account-menu">
              <div class="account-menu-header">
                <UAvatar :text="initials" class="size-9 shrink-0" style="background: var(--surface); color: var(--text-primary); border: 1px solid var(--border)" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold truncate identity-name">{{ recipientName }}</p>
                  <p class="text-xs identity-summary">{{ summaryLine }}</p>
                </div>
              </div>

              <div class="account-menu-divider" />

              <!-- Static row: not itself clickable, the switch is the control -->
              <div class="menu-row menu-row--static">
                <UIcon
                  :name="profile?.profile_is_public ? 'i-heroicons-globe-alt' : 'i-heroicons-lock-closed'"
                  class="menu-row-icon"
                />
                <span class="menu-row-label">
                  {{ profile?.profile_is_public ? 'Public profile' : 'Private profile' }}
                </span>
                <USwitch
                  v-if="profile"
                  :model-value="profile.profile_is_public"
                  size="sm"
                  class="ml-auto"
                  @update:model-value="toggleProfilePublic"
                />
              </div>
              <p v-if="profile" class="menu-row-caption">
                <template v-if="profile.profile_is_public">
                  Anyone with this link sees your {{ totalCerts - hiddenCount }} public certificate{{ totalCerts - hiddenCount === 1 ? '' : 's' }}.
                </template>
                <template v-else>
                  Your profile page is off. Direct certificate links still work.
                </template>
              </p>

              <button
                v-if="profile?.profile_is_public && profileUrl"
                class="menu-row menu-row--action"
                @click="copyProfileUrl"
              >
                <UIcon
                  :name="copiedProfileUrl ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
                  class="menu-row-icon"
                />
                <span class="menu-row-label">{{ copiedProfileUrl ? 'Link copied' : 'Copy profile link' }}</span>
              </button>

              <NuxtLink
                :to="`/p/${me?.id}`"
                target="_blank"
                class="menu-row menu-row--action"
                @click="menuOpen = false"
              >
                <UIcon name="i-heroicons-user-circle" class="menu-row-icon" />
                <span class="menu-row-label">View public profile</span>
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="menu-row-trailing" />
              </NuxtLink>

              <div class="account-menu-divider" />

              <button class="menu-row menu-row--action" @click="logout">
                <UIcon name="i-heroicons-arrow-right-on-rectangle" class="menu-row-icon" />
                <span class="menu-row-label">Log out</span>
              </button>
            </div>
          </template>
        </UPopover>
      </div>
    </header>

    <main class="page-canvas">
      <slot />
    </main>

    <UiFooter />
  </div>
</template>

<style scoped>
.profile-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* White here, not the --canvas-app grey the issuer/admin shells use — this
     is a single-column content page, not a sidebar-framed one, so the grey
     read as an unintentional off-white rather than a deliberate canvas. */
  background: var(--surface);
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

/* ── Account trigger ── */
.account-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  border: 1px solid transparent;
  transition: background-color 0.1s ease, border-color 0.1s ease;
}

.account-trigger:hover {
  background: var(--surface-hover);
  border-color: var(--border);
}

.account-avatar {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.account-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.account-chevron {
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.account-chevron--open {
  transform: rotate(180deg);
}

/* ── Account menu (popover content) ──
   One consistent row system throughout: same padding, same icon size, same
   label typography, whether the row is a static info line, a switch, or a
   clickable action. Nothing here is a one-off component style. */
.account-menu {
  width: 284px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.account-menu-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 10px;
}

.account-menu-divider {
  margin: 6px 8px;
  border-top: 1px solid var(--border);
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 7px 8px;
  border-radius: 8px;
  text-decoration: none;
}

.menu-row--action {
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.menu-row--action:hover {
  background: var(--surface-hover);
}

.menu-row-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.menu-row-label {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
}

.menu-row--action .menu-row-label {
  color: var(--text-primary);
}

.menu-row-trailing {
  width: 13px;
  height: 13px;
  margin-left: auto;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

/* Aligned under the row's label — 8 (row pad) + 16 (icon) + 10 (gap) */
.menu-row-caption {
  padding: 0 8px 6px 34px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-tertiary);
}

.identity-name {
  color: var(--text-primary);
}

.identity-summary {
  color: var(--text-tertiary);
}

.page-canvas {
  flex: 1 0 auto;
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 40px 80px;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .account-chevron { transition: none; }
}

@media (max-width: 640px) {
  .top-bar-inner,
  .page-canvas {
    padding-left: 20px;
    padding-right: 20px;
  }
}
</style>
