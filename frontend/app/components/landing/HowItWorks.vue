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
            <!-- Custom two-tone marks rather than stock glyphs: each one depicts
                 what that step actually does, and the soft filled shape behind
                 the stroked detail is what makes the four read as one set. -->
            <svg class="step-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <!-- 1. Create — an institution, its foundation laid -->
              <template v-if="step.key === 'create'">
                <path class="fill" d="M5 25h22v3H5z" />
                <path class="stroke" d="M4 12.5 16 5l12 7.5" stroke-linecap="round" stroke-linejoin="round" />
                <!-- Evenly spaced about the centre — 8/14/18/24 was symmetric
                     but had uneven gaps, which read as a drafting error. -->
                <path class="stroke" d="M9.2 13v11M13.7 13v11M18.3 13v11M22.8 13v11" stroke-linecap="round" />
                <circle class="fill" cx="16" cy="10" r="1.6" />
              </template>

              <!-- 2. Issue — a document sealed, then sent -->
              <template v-else-if="step.key === 'issue'">
                <rect class="fill" x="6" y="4" width="15" height="20" rx="2.5" />
                <path class="stroke" d="M10 10h7M10 14h7M10 18h4" stroke-linecap="round" />
                <circle class="stroke" cx="22" cy="21" r="5" />
                <path class="stroke" d="m19.8 21 1.6 1.7 2.9-3.2" stroke-linecap="round" stroke-linejoin="round" />
              </template>

              <!-- 3. Recipient shares — one credential, sent outward -->
              <template v-else-if="step.key === 'share'">
                <rect class="fill" x="4" y="8" width="14" height="16" rx="2.5" />
                <path class="stroke" d="M8 13h6M8 17h6M8 21h3" stroke-linecap="round" />
                <path class="stroke" d="M21 16h6m0 0-2.6-2.6M27 16l-2.6 2.6" stroke-linecap="round" stroke-linejoin="round" />
                <circle class="fill" cx="24" cy="7" r="1.5" />
                <circle class="fill" cx="24" cy="25" r="1.5" />
              </template>

              <!-- 4. Anyone verifies — scanned, and found intact -->
              <template v-else>
                <path class="fill" d="M16 4.5 26 8v8.2c0 6-4.2 9.9-10 11.3-5.8-1.4-10-5.3-10-11.3V8z" />
                <path class="stroke" d="m11.8 15.8 3.1 3.2 5.6-6.2" stroke-linecap="round" stroke-linejoin="round" />
                <path class="stroke corner" d="M4 9.5V5.5h4M28 9.5V5.5h-4M4 22.5v4h4M28 22.5v4h-4" stroke-linecap="round" stroke-linejoin="round" />
              </template>
            </svg>
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
    key: 'create',
    title: 'Create',
    body: 'Set up your institution profile and define the credential types you issue.',
    tint: 'green',
  },
  {
    key: 'issue',
    title: 'Issue',
    body: 'Enter recipient details and hit Issue. Verify seals the certificate and sends the recipient a direct link by email.',
    tint: 'green',
  },
  {
    key: 'share',
    title: 'Recipient shares',
    body: 'The recipient gets their certificate link by email and can share it immediately. No account or sign-up required.',
    tint: 'blue',
  },
  {
    key: 'verify',
    title: 'Anyone verifies',
    body: 'Employers or anyone else scans the QR or visits the URL for instant, tamper-evident confirmation. No account needed.',
    tint: 'blue',
  },
]
</script>

<style scoped>
.hiw {
  /* Named once so the icon chips can punch a ring in the SAME colour. Painting
     that ring in --canvas left a white plate behind every chip, because this
     section is tinted and --canvas is not. */
  --hiw-bg: color-mix(in srgb, var(--accent-light) 5%, var(--canvas));

  padding: 96px 40px;
  background: var(--hiw-bg);
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
  top: 38px; /* half of the 76px icon chip */
  left: 12.5%;
  right: 12.5%;
  height: 1.5px;
  /* Fades at both ends so the line reads as a path through the four steps
     rather than a rule that happens to stop under the outer two. */
  background: linear-gradient(
    to right,
    transparent,
    var(--border-strong) 12%,
    var(--border-strong) 88%,
    transparent
  );
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
  width: 76px;
  height: 76px;
  border-radius: 20px;
  background: var(--tint-bg, var(--tint-green));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
  position: relative;
  z-index: 1;
  /* A ring in the canvas colour punches the chip out of the connecting track,
     so the line reads as passing behind rather than colliding with it. */
  box-shadow:
    0 0 0 7px var(--hiw-bg),
    0 6px 16px -8px color-mix(in srgb, var(--tint-icon, var(--tint-green-icon)) 40%, transparent);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.step:hover .step-icon-wrap {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 7px var(--hiw-bg),
    0 12px 22px -8px color-mix(in srgb, var(--tint-icon, var(--tint-green-icon)) 55%, transparent);
}

.step-icon {
  width: 40px;
  height: 40px;
}

/* Two tones from one variable: a soft wash for the mass, full strength for the
   detail drawn on top. Keeps all four marks in the same family automatically. */
.step-icon .fill {
  fill: color-mix(in srgb, var(--tint-icon, var(--tint-green-icon)) 22%, transparent);
}

.step-icon .stroke {
  stroke: var(--tint-icon, var(--tint-green-icon));
  stroke-width: 1.9;
}

/* Scan brackets sit behind the shield conceptually — lighter so the check stays
   the thing you read first. */
.step-icon .corner {
  stroke: color-mix(in srgb, var(--tint-icon, var(--tint-green-icon)) 45%, transparent);
  stroke-width: 1.7;
}

/* Step number badge pinned to the top-left corner of the icon chip */
.step-num {
  position: absolute;
  top: -6px;
  left: -6px;
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  letter-spacing: 0.02em;
  color: var(--tint-icon, var(--tint-green-icon));
  background: var(--canvas);
  border: 1.5px solid color-mix(in srgb, var(--tint-icon, var(--tint-green-icon)) 28%, transparent);
  border-radius: 7px;
  padding: 2px 5px;
  line-height: 1.3;
  z-index: 2;
}

@media (prefers-reduced-motion: reduce) {
  .step-icon-wrap,
  .step:hover .step-icon-wrap {
    transition: none;
    transform: none;
  }
}

.step-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.005em;
}

.step-body {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0;
  max-width: 215px;
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

  /* No track to punch through once the grid wraps, so the ring is dead weight. */
  .step-icon-wrap {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  }

  .step-icon {
    width: 32px;
    height: 32px;
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
