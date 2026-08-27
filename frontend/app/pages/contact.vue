<script setup lang="ts">
/**
 * Contact routing, not a contact form.
 *
 * A form would need a backend endpoint, spam handling and an inbox someone
 * actually watches. None of those exist yet, and a form that silently discards
 * what people write is worse than no form — so this routes each kind of
 * question to the address that can answer it, and says how long a reply takes.
 */
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Contact | Verify',
  description:
    'How to reach Verify: support for certificate holders, onboarding for institutions, privacy requests, and security disclosure.',
  ogTitle: 'Contact | Verify',
  ogDescription: 'Support, institution onboarding, privacy requests and security disclosure.',
})

useHead({ link: [{ rel: 'canonical', href: 'https://verify.app/contact' }] })

const channels = [
  {
    key: 'support',
    icon: 'i-heroicons-lifebuoy',
    tint: 'green',
    title: 'Help with a certificate',
    body: 'You hold a certificate and something is wrong: a claim link that will not open, a certificate you cannot find, or a verification result you did not expect.',
    email: SITE_CONTACT.support,
  },
  {
    key: 'institutions',
    icon: 'i-heroicons-building-library',
    tint: 'blue',
    title: 'Institutions',
    body: 'You want your university, bootcamp or professional body issuing verifiable credentials, or you need issuer accounts for your staff.',
    email: SITE_CONTACT.institutions,
  },
  {
    key: 'privacy',
    icon: 'i-heroicons-shield-check',
    tint: 'violet',
    title: 'Privacy requests',
    body: 'Ask for a copy of your data, have something corrected, or have your account deleted. We reply to these within 30 days.',
    email: SITE_CONTACT.privacy,
  },
  {
    key: 'security',
    icon: 'i-heroicons-bug-ant',
    tint: 'amber',
    title: 'Security disclosure',
    body: 'Report a vulnerability privately. Please give us a reasonable window to fix it before disclosing publicly.',
    email: SITE_CONTACT.security,
  },
]
</script>

<template>
  <div class="contact-page">
    <div class="contact-inner">
      <header class="contact-head">
        <NuxtLink to="/" class="crumb">
          <UIcon name="i-heroicons-arrow-left" class="crumb-icon" />
          Home
        </NuxtLink>
        <h1 class="contact-title">Contact</h1>
        <p class="contact-lead">
          Pick the line that matches your question and it reaches someone who
          can answer it. We reply within {{ SUPPORT_RESPONSE_DAYS }} working
          days.
        </p>
      </header>

      <div class="channels">
        <a
          v-for="channel in channels"
          :key="channel.key"
          :href="`mailto:${channel.email}`"
          class="channel"
          :style="`--tint-bg: var(--tint-${channel.tint}); --tint-icon: var(--tint-${channel.tint}-icon)`"
        >
          <div class="channel-mark">
            <UIcon :name="channel.icon" />
          </div>
          <h2 class="channel-title">{{ channel.title }}</h2>
          <p class="channel-body">{{ channel.body }}</p>
          <span class="channel-email">
            {{ channel.email }}
            <UIcon name="i-heroicons-arrow-up-right" class="channel-arrow" />
          </span>
        </a>
      </div>

      <!--
        Two questions that arrive constantly and that no inbox should have to
        answer one at a time. Both have a correct answer that is not "email us".
      -->
      <section class="faq">
        <h2 class="faq-title">Before you write</h2>

        <div class="faq-item">
          <h3>Something on my certificate is wrong</h3>
          <p>
            Contact the institution that issued it, not us. Certificate details
            are fixed at issuance: changing a name or date changes the
            fingerprint anchored on the blockchain, so only the issuer can
            correct it, by revoking and reissuing.
          </p>
        </div>

        <div class="faq-item">
          <h3>I never received my claim link</h3>
          <p>
            Check spam first, then ask your institution which email address the
            certificate was issued to. Claim links go to that address and
            nowhere else, and we cannot redirect one to a different inbox
            without the institution reissuing it.
          </p>
        </div>

        <div class="faq-item">
          <h3>A certificate came back "Invalid"</h3>
          <p>
            Check the ID for a typo first. It is the single most common cause.
            If the ID is right and the result still says Invalid, the details do
            not match what was anchored on the chain, and the institution that
            issued it is the right place to take that.
            <NuxtLink to="/verify">Try the check again here.</NuxtLink>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.contact-page {
  background: var(--canvas);
}

.contact-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 56px 24px 96px;
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 28px;
  transition: color var(--transition-fast);
}

.crumb:hover { color: var(--accent-text); }
.crumb-icon { width: 14px; height: 14px; }

.contact-title {
  font-size: clamp(30px, 4.5vw, 40px);
  font-weight: 700;
  letter-spacing: -0.028em;
  line-height: 1.12;
  color: var(--text-primary);
  margin: 0;
}

.contact-lead {
  font-size: 16.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 16px 0 0;
  max-width: 52ch;
}

/* ── Channels ── */
.channels {
  margin-top: 44px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.channel {
  display: flex;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  background: var(--surface);
  text-decoration: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast),
              transform var(--transition-fast);
}

.channel:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-panel);
  transform: translateY(-2px);
}

.channel:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.channel-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--tint-bg);
  color: var(--tint-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.channel-mark :deep(svg) {
  width: 19px;
  height: 19px;
}

.channel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.channel-body {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 16px;
  flex: 1;
}

.channel-email {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--accent-text);
}

.channel-arrow {
  width: 13px;
  height: 13px;
  transition: transform var(--transition-fast);
}

.channel:hover .channel-arrow {
  transform: translate(2px, -2px);
}

/* ── FAQ ── */
.faq {
  margin-top: 56px;
  padding-top: 40px;
  border-top: 1px solid var(--border);
}

.faq-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--text-primary);
  margin: 0 0 24px;
}

.faq-item + .faq-item {
  margin-top: 24px;
}

.faq-item h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.faq-item p {
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
  max-width: 68ch;
}

.faq-item :deep(a) {
  color: var(--accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .channel:hover,
  .channel:hover .channel-arrow {
    transform: none;
  }
}

@media (max-width: 720px) {
  .contact-inner {
    padding: 36px 20px 72px;
  }

  .channels {
    grid-template-columns: 1fr;
  }
}
</style>
