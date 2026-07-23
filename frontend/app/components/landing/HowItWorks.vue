<template>
  <section class="hiw reveal">
    <div class="hiw-inner">
      <div class="section-label">How it works</div>
      <h2 class="section-headline">From issue to verification in four steps.</h2>

      <div class="steps">
        <!-- Single track spanning from step 1 icon center to step 4 icon center -->
        <div class="track" aria-hidden="true" />

        <div
          v-for="(step, i) in steps"
          :key="step.title"
          class="step"
          :style="`--step-i: ${i}; --tint-bg: var(--tint-${step.tint}); --tint-icon: var(--tint-${step.tint}-icon)`"
        >
          <div class="step-icon-wrap">
            <UIcon :name="step.icon" class="step-icon" />
            <span class="step-num" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
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
    tint: 'green',
  },
  {
    icon: 'i-heroicons-paper-airplane',
    title: 'Issue',
    body: 'Enter recipient details and hit Issue. Verify seals the certificate and sends the recipient a direct link by email.',
    tint: 'green',
  },
  {
    icon: 'i-heroicons-share',
    title: 'Recipient shares',
    body: 'The recipient gets their certificate link by email and can share it immediately. No account or sign-up required.',
    tint: 'blue',
  },
  {
    icon: 'i-heroicons-magnifying-glass-circle',
    title: 'Anyone verifies',
    body: 'Employers or anyone else scans the QR or visits the URL for instant, tamper-evident confirmation. No account needed.',
    tint: 'blue',
  },
]
</script>

<style scoped>
.hiw {
  padding: 96px 40px;
  background: color-mix(in srgb, var(--accent-light) 5%, var(--canvas));
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  content-visibility: auto;
  contain-intrinsic-size: auto 400px;
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
  text-align: center;
}

.section-headline {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 56px;
  text-align: center;
}

/* ── Steps grid ── */
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  position: relative;
  gap: 0;
}

/* Single track from center of step 1's icon to center of step 4's icon.
   12.5% = half of one equal column in a 4-column grid. */
.track {
  position: absolute;
  top: 22px; /* half of 44px icon chip */
  left: 12.5%;
  right: 12.5%;
  height: 1.5px;
  background: var(--border-strong);
  z-index: 0;
}

/* ── Step ── */
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 16px;
  position: relative;
  z-index: 1;
}

.step-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--tint-bg, var(--tint-green));
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
  color: var(--tint-icon, var(--tint-green-icon));
}

/* Step number badge pinned to top-left corner of the icon chip */
.step-num {
  position: absolute;
  top: -7px;
  left: -7px;
  font-size: 9px;
  font-weight: 700;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  letter-spacing: 0.02em;
  color: var(--text-tertiary);
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 3px;
  line-height: 1.4;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.step-body {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0;
  max-width: 200px;
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

  .track {
    display: none;
  }

  .step {
    padding: 0;
    text-align: left;
    align-items: flex-start;
  }

  .step-body {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .steps {
    grid-template-columns: 1fr;
  }
}
</style>
