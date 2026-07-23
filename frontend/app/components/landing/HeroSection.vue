<template>
  <section ref="heroSectionRef" class="hero reveal" :class="{ 'hero--entered': heroEntered }">
    <!-- Aria-live outside aria-hidden visual so screen readers pick it up -->
    <div aria-live="polite" aria-atomic="true" class="sr-only">{{ ariaAnnounce }}</div>

    <div class="hero-inner">
      <!-- Copy -->
      <div class="hero-copy">
        <h1 class="hero-headline">
          Issue certificates your recipients actually trust.
        </h1>
        <p class="hero-sub">
          Verify lets institutions issue, manage, and revoke digital credentials
          that recipients can share and employers can check instantly. Minutes,
          not days.
        </p>
        <a href="/issuer" class="hero-cta">
          Get started free
        </a>
        <p class="hero-note">No credit card required.</p>
      </div>

      <!-- Certificate card mockup -->
      <div
        class="hero-visual"
        aria-hidden="true"
        @mousemove="onVisualMouseMove"
        @mouseleave="onVisualMouseLeave"
      >
        <div
          ref="cardRef"
          class="cert-card"
          :class="{ 'cert-card--glowing': isGlowing }"
        >
          <!-- Card header -->
          <div class="cert-header">
            <div class="cert-issuer">
              <div class="cert-issuer-badge">U</div>
              <span class="cert-issuer-name">University of Phnom Penh</span>
            </div>
            <!-- Fixed-height status area prevents layout shift across badge states -->
            <div class="cert-status-area">
              <span
                :key="verifyState"
                class="cert-status-badge"
                :class="badgeClass"
              >
                <svg
                  v-if="verifyState === 'verified'"
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ badgeLabel }}
              </span>
              <span
                class="cert-verify-time"
                :class="{ 'cert-verify-time--visible': verifyState === 'verified' }"
              >
                Verified just now · 0.4s
              </span>
            </div>
          </div>

          <!-- Divider -->
          <div class="cert-divider" />

          <!-- Title -->
          <p class="cert-title-label">Certificate of Completion</p>

          <!-- Recipient -->
          <div class="cert-recipient-block">
            <p class="cert-field-label">Awarded to</p>
            <p class="cert-recipient-name">Sarah Kimura</p>
          </div>

          <!-- Course & date -->
          <div class="cert-meta">
            <div>
              <p class="cert-field-label">Course</p>
              <p class="cert-field-value">Web Development Bootcamp</p>
            </div>
            <div>
              <p class="cert-field-label">Completed</p>
              <p class="cert-field-value">June 12, 2025</p>
            </div>
          </div>

          <!-- Bottom bar: QR + cert ID -->
          <div class="cert-footer">
            <div class="cert-qr">
              <div v-for="row in qrRows" :key="row.id" class="cert-qr-row">
                <div
                  v-for="cell in row.cells"
                  :key="cell.id"
                  class="cert-qr-cell"
                  :class="{ 'cert-qr-cell--filled': cell.filled }"
                />
              </div>
              <!-- Scan line mounts only during scanning; CSS animation fires on mount -->
              <div v-if="verifyState === 'scanning'" class="qr-scan-line" aria-hidden="true" />
            </div>
            <div class="cert-id-block">
              <p class="cert-field-label">Certificate ID</p>
              <p class="cert-hash">a3f9e1…c72b</p>
              <p class="cert-chain">Issued via Verify</p>
            </div>
          </div>

          <!-- Verify button: secondary style, reads as part of card mock, not a page CTA -->
          <button
            class="cert-verify-btn"
            :class="{ 'cert-verify-btn--verified': showVerifiedBtn }"
            :disabled="verifyState === 'scanning'"
            @click="onVerifyClick"
          >
            <svg
              v-if="showVerifiedBtn"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              style="flex-shrink: 0"
            >
              <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ btnLabel }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const QR_PATTERN = [
  [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [1,0,1,1,0,1,1,0,0,1,0,1,1,0,1,0,1],
  [0,1,0,0,1,0,0,1,1,0,1,0,0,1,0,1,0],
  [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,0,1,0,1,1,0,1,0,1],
  [1,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0,1],
  [1,1,1,1,1,1,1,1,0,1,1,0,1,0,1,1,0],
]

const qrRows = QR_PATTERN.map((row, ri) => ({
  id: ri,
  cells: row.map((filled, ci) => ({ id: ci, filled: !!filled })),
}))

const heroSectionRef       = ref<HTMLElement | null>(null)
const cardRef              = ref<HTMLElement | null>(null)
const prefersReducedMotion = ref(false)
const canTilt              = ref(false)
const heroEntered          = ref(false)

const verifyState     = ref<'unchecked' | 'scanning' | 'verified'>('unchecked')
const isGlowing       = ref(false)
const showVerifiedBtn = ref(false)
const ariaAnnounce    = ref('')
const heroTimers: ReturnType<typeof setTimeout>[] = []

const badgeLabel = computed(() => {
  if (verifyState.value === 'verified') return 'Verified'
  if (verifyState.value === 'scanning') return 'Checking…'
  return 'Not yet checked'
})

const btnLabel = computed(() =>
  showVerifiedBtn.value ? 'Verified' : 'Verify this certificate'
)

const badgeClass = computed(() =>
  verifyState.value === 'verified' ? 'cert-status-badge--verified' : 'cert-status-badge--neutral'
)

function runVerifyDemo() {
  const s = (fn: () => void, ms: number) => heroTimers.push(setTimeout(fn, ms))
  ariaAnnounce.value = ''
  verifyState.value = 'scanning'
  s(() => {
    verifyState.value = 'verified'
    isGlowing.value = true
    showVerifiedBtn.value = true
    ariaAnnounce.value = 'Certificate verified'
  }, 700)
  s(() => { isGlowing.value = false }, 950)
  s(() => { showVerifiedBtn.value = false }, 2700)
  // Reset and loop — badge returns to unchecked then demo replays
  s(() => { verifyState.value = 'unchecked'; ariaAnnounce.value = '' }, 3500)
  s(runVerifyDemo, 4000)
}

function onVerifyClick() {
  if (verifyState.value === 'scanning') return
  heroTimers.forEach(clearTimeout)
  heroTimers.length = 0
  showVerifiedBtn.value = false
  runVerifyDemo()
}

function onVisualMouseMove(e: MouseEvent) {
  if (!canTilt.value || !cardRef.value || prefersReducedMotion.value) return
  const rect = cardRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = (e.clientX - cx) / (rect.width / 2)
  const dy = (e.clientY - cy) / (rect.height / 2)
  cardRef.value.style.transform = `perspective(1000px) rotateX(${-dy * 2}deg) rotateY(${dx * 3}deg)`
  cardRef.value.style.transition = 'transform 0.15s ease'
}

function onVisualMouseLeave() {
  if (!canTilt.value || !cardRef.value) return
  cardRef.value.style.transform = ''
  cardRef.value.style.transition = 'transform 0.3s ease'
}

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  canTilt.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  // Always mark entered — CSS opacity:1 !important rule handles reduced-motion immediately
  heroEntered.value = true

  if (!prefersReducedMotion.value) {
    const root = heroSectionRef.value
    const enterSelectors = ['.hero-headline', '.hero-sub', '.hero-cta', '.hero-note', '.hero-visual']
    enterSelectors.forEach(sel =>
      root?.querySelector<HTMLElement>(sel)?.style.setProperty('will-change', 'transform, opacity')
    )
    // Remove will-change after last element finishes (.hero-visual: 380ms + 600ms = 980ms)
    heroTimers.push(setTimeout(() => {
      enterSelectors.forEach(sel =>
        root?.querySelector<HTMLElement>(sel)?.style.removeProperty('will-change')
      )
    }, 1050))
  }

  // Always auto-play — CSS gates which animations play based on prefers-reduced-motion
  heroTimers.push(setTimeout(runVerifyDemo, 1400))
})

onUnmounted(() => heroTimers.forEach(clearTimeout))
</script>

<style scoped>
/* ── Accessibility ── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Section ── */
.hero {
  padding: 88px 40px 80px;
}

.hero-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
}

/* ── Copy ── */
.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* ── Entrance: elements start invisible until JS sets .hero--entered ── */
.hero-headline,
.hero-sub,
.hero-cta,
.hero-note {
  opacity: 0;
}

.hero-visual {
  opacity: 0;
}

/* Reduced motion: show all immediately, before JS even runs */
@media (prefers-reduced-motion: reduce) {
  .hero-headline,
  .hero-sub,
  .hero-cta,
  .hero-note,
  .hero-visual {
    opacity: 1 !important;
  }
}

/* Entrance stagger — triggered by .hero--entered class set in onMounted */
@media (prefers-reduced-motion: no-preference) {
  .hero--entered .hero-headline {
    animation: heroFadeUp 0.55s ease 0ms forwards;
  }
  .hero--entered .hero-sub {
    animation: heroFadeUp 0.55s ease 80ms forwards;
  }
  .hero--entered .hero-cta {
    animation: heroFadeUp 0.55s ease 160ms forwards;
  }
  .hero--entered .hero-note {
    animation: heroFadeUp 0.55s ease 240ms forwards;
  }
  .hero--entered .hero-visual {
    animation: heroSlideRight 0.6s cubic-bezier(0.22, 1, 0.36, 1) 380ms forwards;
  }

  @keyframes heroFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes heroSlideRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
}

.hero-headline {
  font-size: 44px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin: 0 0 20px;
  max-width: 500px;
}

.hero-sub {
  font-size: 17px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0 0 32px;
  max-width: 440px;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  padding: 12px 24px;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s ease;
  margin-bottom: 12px;
}

.hero-cta:hover {
  background: var(--accent-text);
}

.hero-cta:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.hero-note {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Visual ── */
.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

/* Faint dot-grid behind card — border-color contrast, barely visible */
.hero-visual::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

/* ── Certificate card ── */
.cert-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 4px 24px rgba(55, 53, 47, 0.07), 0 1px 4px rgba(55, 53, 47, 0.04);
  transition: border-color 0.25s ease, transform 0.2s ease;
  position: relative;
  z-index: 1;
}

/* Hover shadow layer — only opacity transitions (compositor-safe) */
.cert-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 8px 32px rgba(55, 53, 47, 0.12), 0 2px 8px rgba(55, 53, 47, 0.06);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
  z-index: -1;
}

/* Glow ring layer — accent outline via opacity (compositor-safe) */
.cert-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  box-shadow: 0 0 0 2px var(--accent);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
  z-index: -1;
}

@media (prefers-reduced-motion: no-preference) {
  .cert-card:hover {
    transform: translateY(-2px);
  }

  .cert-card:hover::after { opacity: 1; }

  /* Pulse the verified badge on card hover */
  .cert-card:hover .cert-status-badge--verified {
    animation: verifyPulse 0.35s ease forwards;
  }
}

/* Glow state during verification — accent ring via ::before opacity */
.cert-card--glowing {
  border-color: var(--accent);
}

.cert-card--glowing::before { opacity: 1; }

@keyframes verifyPulse {
  0%   { transform: scale(1);    opacity: 0.8; }
  50%  { transform: scale(1.07); opacity: 1;   }
  100% { transform: scale(1);    opacity: 1;   }
}

.cert-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
}

.cert-issuer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cert-issuer-badge {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--accent-light);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cert-issuer-name {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ── Status area: min-height reserves space for badge + timestamp — zero layout shift ── */
.cert-status-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-height: 44px;
  flex-shrink: 0;
}

.cert-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.cert-status-badge--neutral {
  background: var(--surface-hover);
  color: var(--text-tertiary);
}

.cert-status-badge--verified {
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
}

/* badgePop fires on mount via :key remount — no JS needed per-trigger */
@media (prefers-reduced-motion: no-preference) {
  .cert-status-badge--verified {
    animation: badgePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes badgePop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
}

.cert-verify-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.3s ease 0.2s, transform 0.3s ease 0.2s;
  white-space: nowrap;
}

.cert-verify-time--visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .cert-verify-time {
    transition: none;
  }
}

.cert-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 16px;
}

.cert-title-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin: 0 0 12px;
}

.cert-recipient-block {
  margin-bottom: 16px;
}

.cert-field-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0 0 2px;
}

.cert-recipient-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.cert-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.cert-field-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

/* ── Footer row: QR + cert ID ── */
.cert-footer {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* ── QR code ── */
.cert-qr {
  display: flex;
  flex-direction: column;
  gap: 1.5px;
  flex-shrink: 0;
  position: relative;
  /* 14 rows × 4px + 13 gaps × 1.5px ≈ 75.5px; scan line travels 74px */
  --qr-h: 74px;
}

/* Scan line is v-if mounted; animation auto-starts on mount, auto-stops on unmount */
.qr-scan-line {
  position: absolute;
  top: 0;       /* static starting position — animation uses transform, not top */
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  border-radius: 1px;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .qr-scan-line {
    animation: qrScan 0.7s ease-in-out forwards;
  }

  /* translateY instead of top — compositor-safe, no layout reflow per frame */
  @keyframes qrScan {
    0%   { transform: translateY(0);              opacity: 1; }
    85%  { transform: translateY(var(--qr-h));    opacity: 1; }
    100% { transform: translateY(var(--qr-h));    opacity: 0; }
  }
}

.cert-qr-row {
  display: flex;
  gap: 1.5px;
}

.cert-qr-cell {
  width: 4px;
  height: 4px;
  border-radius: 0.5px;
  background: var(--border);
}

.cert-qr-cell--filled {
  background: var(--text-primary);
}

/* ── Cert ID block ── */
.cert-id-block {
  flex: 1;
  min-width: 0;
}

.cert-hash {
  font-size: 12px;
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  color: var(--text-primary);
  font-weight: 500;
  margin: 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cert-chain {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

/* ── Verify button: secondary — part of the card mock, NOT a page CTA ── */
.cert-verify-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.cert-verify-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.cert-verify-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cert-verify-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cert-verify-btn--verified {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .hero {
    padding: 64px 24px 56px;
  }

  .hero-inner {
    grid-template-columns: 1fr;
    gap: 48px;
  }

  .hero-headline {
    font-size: 34px;
  }

  .hero-visual {
    order: -1;
  }

  .cert-card {
    max-width: 100%;
  }
}
</style>
