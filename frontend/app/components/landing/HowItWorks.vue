<template>
  <section class="hiw reveal">
    <div class="hiw-inner">
      <div class="section-label">How it works</div>
      <h2 class="section-headline">From issue to verification in four steps.</h2>

      <div class="steps">
        <div v-for="(step, i) in steps" :key="step.title" class="step">
          <!-- Connector line (between steps) -->
          <div v-if="i < steps.length - 1" class="connector" aria-hidden="true" />

          <div class="step-number">{{ String(i + 1).padStart(2, '0') }}</div>
          <div class="step-icon-wrap">
            <UIcon :name="step.icon" class="step-icon" />
          </div>
          <h3 class="step-title">{{ step.title }}</h3>
          <p class="step-body">{{ step.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const steps = [
  {
    icon: 'i-heroicons-building-library',
    title: 'Create',
    body: 'Set up your institution profile and define the credential types you issue.',
  },
  {
    icon: 'i-heroicons-paper-airplane',
    title: 'Issue',
    body: 'Enter recipient details and hit Issue. Verify seals the certificate and sends the recipient a direct link by email — done.',
  },
  {
    icon: 'i-heroicons-share',
    title: 'Recipient shares',
    body: 'The recipient gets their certificate link by email and can share it immediately — no account and no sign-up required.',
  },
  {
    icon: 'i-heroicons-magnifying-glass-circle',
    title: 'Anyone verifies',
    body: 'Employers or anyone else scans the QR or visits the URL — instant, tamper-evident confirmation, no account needed.',
  },
]
</script>

<style scoped>
.hiw {
  padding: 96px 40px;
  background: var(--surface-hover);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.hiw-inner {
  max-width: 1120px;
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
  margin: 0 0 56px;
}

/* ── Steps grid ── */
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  position: relative;
}

.step {
  position: relative;
  padding: 0 32px 0 0;
}

.step:last-child {
  padding-right: 0;
}

/* Connector line between steps */
.connector {
  position: absolute;
  top: 44px; /* aligns with center of icon */
  right: 0;
  width: calc(100% - 52px); /* gap between icons */
  left: 52px;
  height: 1px;
  background: var(--border-strong);
  pointer-events: none;
  z-index: 0;
}

/* Large step number */
.step-number {
  font-size: 13px;
  font-weight: 700;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  color: var(--text-tertiary);
  margin-bottom: 16px;
  letter-spacing: 0.05em;
}

/* Icon */
.step-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

.step-icon {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.step-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .hiw {
    padding: 64px 24px;
  }

  .section-headline {
    font-size: 26px;
    margin-bottom: 40px;
  }

  .steps {
    grid-template-columns: 1fr 1fr;
    gap: 32px 24px;
  }

  .connector {
    display: none;
  }

  .step {
    padding: 0;
  }
}

@media (max-width: 480px) {
  .steps {
    grid-template-columns: 1fr;
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
