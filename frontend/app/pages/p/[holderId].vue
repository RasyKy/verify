<script setup lang="ts">
import type { PublicProfile } from '~/composables/usePublicProfile'

definePageMeta({ layout: false })

const route = useRoute()
const holderId = route.params.holderId as string
const { public: { apiBase } } = useRuntimeConfig()

// Public endpoint — no bearer token, so plain useFetch rather than useApi(),
// same as pages/cert/[certId].vue. SSR-rendered so a shared profile link shows
// its certificates without a client round-trip.
//
// Awaited, unlike the cert page's fetch, because setResponseStatus below has to
// read `error` during setup: without the await it runs while the request is
// still in flight, sees a null error and leaves a missing profile answering 200.
const { data: profile, pending, error } = await useFetch<PublicProfile>(
  () => `/api/profiles/${holderId}`,
  { baseURL: apiBase, default: () => null },
)

/**
 * 404 and "the API is down" must not render as the same thing, for the same
 * reason the verify page separates them: one is a fact about the profile, the
 * other is a fact about our infrastructure, and showing "this profile isn't
 * available" during an outage tells a visitor something false about a person.
 */
const unavailableProfile = computed(() => error.value?.statusCode === 404)
const serviceDown = computed(() => Boolean(error.value) && !unavailableProfile.value)

// A missing or private profile should answer 404 rather than 200-with-a-message,
// so the status line matches what the page says. Rendered as our own card, not
// via createError, to keep the branded shell instead of the generic error page.
if (import.meta.server && unavailableProfile.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}

const displayName = computed(() => profile.value?.holder.display_name ?? '')
const certificates = computed(() => profile.value?.certificates ?? [])

const initials = computed(() =>
  displayName.value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const summaryLine = computed(() => {
  const n = certificates.value.length
  return `${n} verified certificate${n === 1 ? '' : 's'}`
})

/**
 * noindex, matching every other public page in the app — and load-bearing here
 * rather than incidental. `profiles.profile_is_public` defaults to TRUE, so
 * every holder has one of these pages without ever having asked for it; letting
 * search engines index them would publish people's credential histories under
 * their real names on the strength of a default they never chose. The page stays
 * shareable by link, which is what the holder actually opted into.
 */
useHead({
  title: () => (displayName.value ? `${displayName.value} — Verify` : 'Verify'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="min-h-screen page-ground">
    <div class="profile-page">
      <!-- Logo + wordmark -->
      <div class="flex items-center justify-center mb-10">
        <NuxtLink to="/" aria-label="Verify — home">
          <BrandLogo :size="32" wordmark />
        </NuxtLink>
      </div>

      <!-- Outage — deliberately NOT rendered as "profile not available" -->
      <div v-if="serviceDown" class="state-card">
        <UIcon name="i-heroicons-exclamation-triangle" class="size-8 state-icon-warn" />
        <h1 class="state-title">This page is temporarily unavailable</h1>
        <p class="state-body">
          We could not reach the service, so we cannot load this profile right now.
          Please try again shortly.
        </p>
        <UButton class="mt-4" variant="soft" color="neutral" @click="refreshNuxtData()">
          Try again
        </UButton>
      </div>

      <!--
        One message for "no such profile" and "this profile is private", because
        the API deliberately answers both with the same 404 — saying "private"
        would confirm the account exists, which is the fact the setting exists
        to withhold.
      -->
      <div v-else-if="unavailableProfile" class="state-card">
        <UIcon name="i-heroicons-lock-closed" class="size-8 state-icon-muted" />
        <h1 class="state-title">Profile not available</h1>
        <p class="state-body">
          This profile does not exist, or its owner has chosen not to share it.
        </p>
        <UButton class="mt-4" variant="soft" color="neutral" to="/verify">
          Verify a certificate instead
        </UButton>
      </div>

      <div v-else-if="pending" class="state-card">
        <p class="state-body">Loading profile…</p>
      </div>

      <template v-else-if="profile">
        <!-- Profile header -->
        <header class="profile-header">
          <div class="avatar">{{ initials }}</div>
          <h1 class="profile-name">{{ displayName }}</h1>
          <p class="profile-summary">{{ summaryLine }}</p>
        </header>

        <div v-if="certificates.length" class="cert-grid">
          <ProfileCertificateCard
            v-for="(cert, index) in certificates"
            :key="cert.id"
            class="card-in"
            :style="{ '--i': index }"
            :cert="cert"
          />
        </div>

        <!--
          A public profile with nothing on it is a real, chosen state: the holder
          has hidden every certificate. Saying so plainly beats an empty page
          that reads as broken.
        -->
        <div v-else class="empty-state">
          <UIcon name="i-heroicons-document-text" class="size-8" />
          <p>This profile has no public certificates.</p>
        </div>

        <p class="footnote">
          Every certificate here can be independently verified against the
          blockchain record. <NuxtLink to="/verify" class="footnote-link">Check one yourself</NuxtLink>.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 40px 80px;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-bottom: 40px;
  margin-bottom: 32px;
  border-bottom: 1px solid var(--border);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 16px;
}

.profile-name {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-summary {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.cert-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .cert-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .cert-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.state-card {
  max-width: 32rem;
  margin: 0 auto;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-panel);
  padding: 40px 32px;
}

.state-icon-warn  { color: #B58A2E; }
.state-icon-muted { color: var(--text-tertiary); }

.state-title {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-body {
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-state {
  color: var(--text-tertiary);
  text-align: center;
  padding: 4rem 0;
}

.footnote {
  margin-top: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.footnote-link {
  color: var(--accent-text);
  text-decoration: underline;
}

@media (max-width: 640px) {
  .profile-page { padding-left: 20px; padding-right: 20px; }
}
</style>
