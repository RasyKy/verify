<template>
  <section class="faq reveal">
    <div class="faq-inner">
      <div class="section-label">FAQ</div>
      <h2 class="section-headline">Frequently asked questions.</h2>

      <div class="faq-list">
        <details v-for="item in faqs" :key="item.q" class="faq-item">
          <summary class="faq-summary">
            <span class="faq-q">{{ item.q }}</span>
            <span class="faq-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </summary>
          <p class="faq-a">{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const faqs = [
  {
    q: 'How does certificate verification work?',
    a: 'When you issue a certificate, Verify creates a digital fingerprint of the recipient details. Anyone verifying re-checks that fingerprint — if it matches, the certificate is genuine. Changing any field breaks the match, making the certificate immediately show as invalid.',
  },
  {
    q: 'Who can verify a certificate?',
    a: 'Anyone — employers, universities, event organisers, or members of the public. Verification is public and requires no account. Verifiers just scan the QR code or visit the certificate URL.',
  },
  {
    q: 'What happens if I need to revoke a certificate?',
    a: 'Issuers can revoke any certificate from the dashboard with one click. The change takes effect immediately. Any subsequent verification attempt will return a "Revoked" status, so recipients can no longer present the certificate as valid.',
  },
  {
    q: 'Do recipients need to create an account?',
    a: 'No. Recipients receive their certificate as a direct link by email and can view and share it immediately — no account required. They can optionally save the certificate to a personal dashboard for privacy controls, but this is never required for sharing or verification.',
  },
  {
    q: 'Who owns my institution\'s credential data?',
    a: 'Your institution does. Recipient names, emails, and certificate details are stored securely in your account and are never sold or shared with third parties. You can export or delete your data at any time.',
  },
]
</script>

<style scoped>
.faq {
  padding: 96px 40px;
}

.faq-inner {
  max-width: 720px;
  margin: 0 auto;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}

.section-headline {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 48px;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.faq-item {
  border-bottom: 1px solid var(--border);
}

.faq-item:first-child {
  border-top: 1px solid var(--border);
}

.faq-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.faq-summary::-webkit-details-marker {
  display: none;
}

.faq-q {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.faq-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
}

.faq-item[open] .faq-chevron {
  transform: rotate(180deg);
}

.faq-a {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
  padding-bottom: 20px;
}

/* Disable chevron animation for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  .faq-chevron {
    transition: none;
  }
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .faq {
    padding: 64px 24px;
  }

  .section-headline {
    font-size: 26px;
  }
}

/* ── Scroll reveal ── */
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(16px);
    animation: fadeUp 0.55s ease forwards;
    animation-delay: 0.05s;
  }
}

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
</style>
