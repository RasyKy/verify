<template>
  <section class="features reveal">
    <div class="features-inner">
      <div class="section-label">Features</div>
      <h2 class="section-headline">Everything you need to issue credentials at scale.</h2>

      <div class="bento">

        <!-- ── Card 1: Instant verification (blue) ── -->
        <div ref="verifyCardRef" class="bento-card bento-card--tint-blue">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-qr-code" class="card-icon" />
          </div>
          <h3 class="card-title">Instant verification, no account needed</h3>
          <p class="card-body">
            Scan a QR code and see the verified credential in seconds.
          </p>

          <div
            class="verify-stage"
            :class="`verify-stage--${verifyPhase}`"
            aria-hidden="true"
          >
            <!-- Layer 1: QR scene -->
            <div class="qr-scene">
              <div class="viewfinder">
                <span class="vf-corner vf-tl" />
                <span class="vf-corner vf-tr" />
                <span class="vf-corner vf-bl" />
                <span class="vf-corner vf-br" />
                <svg class="qr-svg" width="72" height="72" viewBox="0 0 9 9" shape-rendering="crispEdges">
                  <!-- Top-left finder -->
                  <rect x="0" y="0" width="3" height="3" fill="currentColor"/>
                  <rect x=".5" y=".5" width="2" height="2" fill="var(--canvas)"/>
                  <rect x="1" y="1" width="1" height="1" fill="currentColor"/>
                  <!-- Top-right finder -->
                  <rect x="6" y="0" width="3" height="3" fill="currentColor"/>
                  <rect x="6.5" y=".5" width="2" height="2" fill="var(--canvas)"/>
                  <rect x="7" y="1" width="1" height="1" fill="currentColor"/>
                  <!-- Bottom-left finder -->
                  <rect x="0" y="6" width="3" height="3" fill="currentColor"/>
                  <rect x=".5" y="6.5" width="2" height="2" fill="var(--canvas)"/>
                  <rect x="1" y="7" width="1" height="1" fill="currentColor"/>
                  <!-- Data modules -->
                  <rect x="4" y="0" width="1" height="1" fill="currentColor"/>
                  <rect x="3" y="1" width="1" height="1" fill="currentColor"/>
                  <rect x="5" y="1" width="1" height="1" fill="currentColor"/>
                  <rect x="4" y="2" width="1" height="1" fill="currentColor"/>
                  <rect x="3" y="3" width="1" height="1" fill="currentColor"/>
                  <rect x="5" y="3" width="1" height="1" fill="currentColor"/>
                  <rect x="3" y="4" width="1" height="1" fill="currentColor"/>
                  <rect x="5" y="4" width="1" height="1" fill="currentColor"/>
                  <rect x="4" y="5" width="1" height="1" fill="currentColor"/>
                  <rect x="6" y="3" width="1" height="1" fill="currentColor"/>
                  <rect x="7" y="4" width="1" height="1" fill="currentColor"/>
                  <rect x="8" y="3" width="1" height="1" fill="currentColor"/>
                  <rect x="6" y="5" width="1" height="1" fill="currentColor"/>
                  <rect x="8" y="5" width="1" height="1" fill="currentColor"/>
                  <rect x="3" y="6" width="1" height="1" fill="currentColor"/>
                  <rect x="5" y="6" width="1" height="1" fill="currentColor"/>
                  <rect x="4" y="7" width="1" height="1" fill="currentColor"/>
                  <rect x="6" y="7" width="1" height="1" fill="currentColor"/>
                  <rect x="8" y="7" width="1" height="1" fill="currentColor"/>
                  <rect x="3" y="8" width="1" height="1" fill="currentColor"/>
                  <rect x="5" y="8" width="1" height="1" fill="currentColor"/>
                  <rect x="7" y="8" width="1" height="1" fill="currentColor"/>
                </svg>
                <div class="scan-line" />
              </div>
            </div>

            <!-- Layer 2: Cert reveal -->
            <div class="cert-reveal">
              <div class="cert-card-inner">
                <div class="cert-avatar">SC</div>
                <span class="cert-name">Sopheap Chan</span>
                <span class="cert-course">Web Development</span>
                <span class="cert-issuer">Mekong University</span>
                <span class="cert-badge">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Verified
                </span>
              </div>
            </div>
          </div>

          <span class="sr-only">Animation: a QR code is scanned, revealing a verified certificate for Sopheap Chan</span>
        </div>

        <!-- ── Card 2: Role-based access (violet) ── -->
        <div ref="roleCardRef" class="bento-card bento-card--tint-violet">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-users" class="card-icon" />
          </div>
          <h3 class="card-title">Role-based access</h3>
          <p class="card-body">
            Separate portals for Issuers, Admins, and Recipients. Each role sees
            exactly what it needs.
          </p>

          <div class="role-stage" aria-hidden="true">
            <div class="role-windows">

              <!-- Issuer window -->
              <div class="role-window" :class="windowClass(0)">
                <div class="win-titlebar win-tb--green">
                  <span class="win-dot" /><span class="win-dot" /><span class="win-dot" />
                  <span class="win-title">Issuer</span>
                </div>
                <div class="win-body">
                  <div class="win-row">
                    <span class="win-name">Sopheap C.</span>
                    <span class="win-chip win-chip--green">Issued</span>
                  </div>
                  <div class="win-row">
                    <span class="win-name">Virak P.</span>
                    <span class="win-chip win-chip--green">Issued</span>
                  </div>
                  <div class="win-btn win-btn--green">+ Issue cert</div>
                </div>
              </div>

              <!-- Admin window -->
              <div class="role-window" :class="windowClass(1)">
                <div class="win-titlebar win-tb--violet">
                  <span class="win-dot" /><span class="win-dot" /><span class="win-dot" />
                  <span class="win-title">Admin</span>
                </div>
                <div class="win-body">
                  <div class="win-row">
                    <span class="win-name">Lyhour V.</span>
                    <span class="win-chip win-chip--violet">Issuer</span>
                  </div>
                  <div class="win-row">
                    <span class="win-name">Cheata R.</span>
                    <span class="win-chip win-chip--violet">Issuer</span>
                  </div>
                  <div class="win-settings-row">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="2" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M6 1v1.2M6 9.8V11M1 6h1.2M9.8 6H11M2.75 2.75l.85.85M8.4 8.4l.85.85M9.25 2.75l-.85.85M3.6 8.4l-.85.85" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                    </svg>
                    <span>Settings</span>
                  </div>
                </div>
              </div>

              <!-- Recipient window -->
              <div class="role-window" :class="windowClass(2)">
                <div class="win-titlebar win-tb--blue">
                  <span class="win-dot" /><span class="win-dot" /><span class="win-dot" />
                  <span class="win-title">Recipient</span>
                </div>
                <div class="win-body win-body--centered">
                  <div class="win-cert-row">
                    <div class="win-cert-badge">M</div>
                    <div class="win-cert-info">
                      <span class="win-cert-title">Web Dev</span>
                      <span class="win-cert-sub">Mekong Uni</span>
                    </div>
                    <span class="win-chip win-chip--green">
                      <UIcon name="i-heroicons-check-badge-solid" class="win-chip-icon" />
                    </span>
                  </div>
                  <div class="win-share">
                    Share
                    <UIcon name="i-heroicons-arrow-up-right" class="win-share-icon" />
                  </div>
                </div>
              </div>

            </div>
            <p class="role-caption">{{ roleCaptions[spotlightRole] }}</p>
          </div>

          <span class="sr-only">Demo: three separate portals for Issuers, Admins, and Recipients, each showing different controls</span>
        </div>

        <!-- ── Card 3: Tamper-evident (green) ── -->
        <div ref="tamperCardRef" class="bento-card bento-card--tint-green">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-shield-check" class="card-icon" />
          </div>
          <h3 class="card-title">Tamper-evident certificates</h3>
          <p class="card-body">
            Hashed and sealed on the blockchain. Change any detail after issuance and verification flags it instantly.
          </p>

          <div class="chain-stage" aria-hidden="true">
            <!-- Row 1: cert chip -->
            <div class="chain-cert" :class="{ 'chain-cert--visible': chainVisible }">
              <div class="chain-cert-avatar">SC</div>
              <div class="chain-cert-info">
                <span class="chain-cert-name">Sopheap Chan</span>
                <span
                  class="chain-cert-course"
                  :class="{ 'chain-cert-course--highlight': certHighlight }"
                >{{ certText }}</span>
              </div>
              <span
                class="chain-status"
                :class="certStatus === 'invalid' ? 'chain-status--invalid' : 'chain-status--valid'"
              >
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    v-if="certStatus === 'verified'"
                    d="M2 6L5 9L10 3"
                    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
                  />
                  <path
                    v-else
                    d="M3 3L9 9M9 3L3 9"
                    stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
                  />
                </svg>
                {{ certStatus === 'verified' ? 'Verified' : 'Invalid' }}
              </span>
            </div>

            <!-- Row 2: hash row -->
            <div
              class="chain-hash-row"
              :class="{ 'chain-hash-row--visible': chainVisible && chainPhase !== 'idle' && chainPhase !== 'appear' }"
            >
              <span class="chain-hash-label">CERT HASH</span>
              <span
                class="chain-hash chain-hash--good"
                :class="{ 'chain-hash--visible': !badHashVisible && (chainPhase === 'hash-slide' || chainPhase === 'sealed' || chainPhase === 'final') }"
              >a3f9…c72b</span>
              <span
                v-if="badHashVisible"
                class="chain-hash chain-hash--bad"
                :class="{ 'chain-hash--shake': chainMismatch }"
              >e7d2…f08a</span>
            </div>

            <!-- Row 3: blocks -->
            <div
              class="chain-blocks-row"
              :class="{ 'chain-blocks-row--visible': chainVisible && chainPhase !== 'idle' && chainPhase !== 'appear' }"
            >
              <div class="chain-block chain-block--old">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect x="1.5" y="4" width="7" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M3 4V3C3 1.9 3.9 1 5 1S7 1.9 7 3V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="chain-connector" />
              <div class="chain-block chain-block--old">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect x="1.5" y="4" width="7" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M3 4V3C3 1.9 3.9 1 5 1S7 1.9 7 3V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="chain-connector" />
              <div class="chain-block chain-block--old">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect x="1.5" y="4" width="7" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M3 4V3C3 1.9 3.9 1 5 1S7 1.9 7 3V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
              <div
                class="chain-connector chain-connector--new"
                :class="{ 'chain-connector--visible': chainPhase === 'sealed' || chainPhase === 'bad-hash' || chainPhase === 'mismatch' || chainPhase === 'final' }"
              />
              <div
                class="chain-block chain-block--new"
                :class="{
                  'chain-block--sealed': chainPhase === 'sealed' || chainPhase === 'bad-hash' || chainPhase === 'final',
                  'chain-block--mismatch': chainMismatch,
                }"
              >
                <svg v-if="!chainMismatch" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <rect x="1.5" y="4" width="7" height="5.5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M3 4V3C3 1.9 3.9 1 5 1S7 1.9 7 3V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <svg v-else width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
          </div>

          <span class="sr-only">Animation: a certificate field is tampered with, the hash changes, the blockchain flags it as Invalid, then it reverts to Verified</span>
        </div>

      </div>

      <p class="features-credibility">
        Built for institutions that need to move fast without sacrificing rigour.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
// ── Refs ──────────────────────────────────────────────────────────────────────
const verifyCardRef = ref<HTMLElement | null>(null)
const roleCardRef   = ref<HTMLElement | null>(null)
const tamperCardRef = ref<HTMLElement | null>(null)

// ── Shared ────────────────────────────────────────────────────────────────────
const prefersReducedMotion = ref(false)

// ─────────────────────────────────────────────────────────────────────────────
// Card 1 — QR scan → cert reveal
// ─────────────────────────────────────────────────────────────────────────────
const verifyPhase = ref<'idle' | 'scanning' | 'exit' | 'cert'>('idle')
const verifyTimers: ReturnType<typeof setTimeout>[] = []

function resetVerifyDemo() {
  verifyTimers.forEach(clearTimeout)
  verifyTimers.length = 0
  verifyPhase.value = 'idle'
}

function runVerifyDemo() {
  if (verifyPhase.value !== 'idle') return  // guard: already running
  const s = (fn: () => void, ms: number) => verifyTimers.push(setTimeout(fn, ms))
  verifyPhase.value = 'scanning'
  s(() => { verifyPhase.value = 'exit' }, 800)
  s(() => { verifyPhase.value = 'cert' }, 1200)
  // Show cert result for 2 s then loop
  s(() => { verifyPhase.value = 'idle' }, 3200)
  s(runVerifyDemo, 3600)
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 2 — Three portal windows + spotlight cycle
// ─────────────────────────────────────────────────────────────────────────────
const spotlightRole    = ref(0)
const roleCycleComplete = ref(false)
let roleIsVisible = false
let roleCycleCount = 0
let roleTimer: ReturnType<typeof setTimeout> | null = null

const roleCaptions = [
  'Issuers create and revoke certificates',
  'Admins manage the organization',
  'Recipients view and share credentials',
]

function windowClass(i: number) {
  if (roleCycleComplete.value || prefersReducedMotion.value) return 'role-window--settled'
  return spotlightRole.value === i ? 'role-window--spotlight' : ''
}

function stopSpotlight() {
  if (roleTimer !== null) { clearTimeout(roleTimer); roleTimer = null }
}

function scheduleSpotlight() {
  stopSpotlight()
  if (!roleIsVisible || prefersReducedMotion.value) return
  roleTimer = setTimeout(() => {
    if (!roleIsVisible) return
    roleCycleCount++
    spotlightRole.value = roleCycleCount % 3
    scheduleSpotlight()  // always continue cycling
  }, 1800)
}

function startSpotlight() {
  spotlightRole.value = 0
  roleCycleCount = 0
  roleCycleComplete.value = false
  scheduleSpotlight()
}

// ─────────────────────────────────────────────────────────────────────────────
// Card 3 — Blockchain tamper visualization
// ─────────────────────────────────────────────────────────────────────────────
const certText       = ref('Web Development')
const certStatus     = ref<'verified' | 'invalid'>('verified')
const certHighlight  = ref(false)
const chainPhase     = ref<'idle' | 'appear' | 'hash-slide' | 'sealed' | 'bad-hash' | 'mismatch' | 'final'>('idle')
const chainVisible   = ref(false)
const badHashVisible = ref(false)
const chainMismatch  = ref(false)
const tamperTimers: ReturnType<typeof setTimeout>[] = []

function resetTamperDemo() {
  tamperTimers.forEach(clearTimeout)
  tamperTimers.length = 0
  certText.value = 'Web Development'
  certStatus.value = 'verified'
  certHighlight.value = false
  chainPhase.value = 'idle'
  chainVisible.value = false
  badHashVisible.value = false
  chainMismatch.value = false
}

function runTamperDemo() {
  if (chainPhase.value !== 'idle') return  // guard: already running
  const s = (fn: () => void, ms: number) => tamperTimers.push(setTimeout(fn, ms))
  chainVisible.value = true
  chainPhase.value = 'appear'
  s(() => { chainPhase.value = 'hash-slide' }, 400)
  s(() => { chainPhase.value = 'sealed' }, 1100)
  s(() => { certHighlight.value = true }, 2000)
  s(() => { certText.value = 'Data Science'; certHighlight.value = false }, 2300)
  s(() => { badHashVisible.value = true; chainPhase.value = 'bad-hash' }, 2600)
  s(() => { chainMismatch.value = true; chainPhase.value = 'mismatch' }, 3100)
  s(() => { certStatus.value = 'invalid' }, 3300)
  s(() => {
    certText.value = 'Web Development'
    certStatus.value = 'verified'
    chainMismatch.value = false
    badHashVisible.value = false
    chainPhase.value = 'final'
  }, 4800)
  // Hold final verified state for 3.2 s, reset state, then loop.
  // Cannot call resetTamperDemo() here — it clears tamperTimers, which would cancel
  // the runTamperDemo timer scheduled right after it.
  s(() => {
    certText.value = 'Web Development'
    certStatus.value = 'verified'
    certHighlight.value = false
    chainPhase.value = 'idle'
    chainVisible.value = false
    badHashVisible.value = false
    chainMismatch.value = false
    // Push a fresh restart timer now that tamperTimers has been naturally drained
    tamperTimers.push(setTimeout(runTamperDemo, 400))
  }, 8000)
}

// ── Shared IntersectionObserver (3 targets → 1 observer at threshold 0.3) ────
useIntersect(verifyCardRef, (entry) => {
  if (entry.isIntersecting) {
    if (!prefersReducedMotion.value) runVerifyDemo()
  } else {
    resetVerifyDemo()
  }
})

useIntersect(roleCardRef, (entry) => {
  roleIsVisible = entry.isIntersecting
  if (roleIsVisible) {
    if (!prefersReducedMotion.value) startSpotlight()
  } else {
    stopSpotlight()
  }
})

useIntersect(tamperCardRef, (entry) => {
  if (entry.isIntersecting) {
    if (!prefersReducedMotion.value) runTamperDemo()
  } else {
    resetTamperDemo()
  }
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion.value) {
    verifyPhase.value = 'cert'
    chainVisible.value = true
    chainPhase.value = 'final'
    roleCycleComplete.value = true
  }
})

onUnmounted(() => {
  stopSpotlight()
  verifyTimers.forEach(clearTimeout)
  tamperTimers.forEach(clearTimeout)
})
</script>

<style scoped>
/* ── Section ── */
.features {
  padding: 96px 40px;
}

.features-inner {
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
  margin: 0 0 48px;
  max-width: 560px;
}

/* ── Bento: 3 equal columns ── */
.bento {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* ── Cards ── */
.bento-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s ease, transform 0.15s ease;
  position: relative;
}

/* Hover shadow layer — only opacity transitions (compositor-safe) */
.bento-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 6px 20px rgba(55, 53, 47, 0.07);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 0;
}

.bento-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.bento-card:hover::after { opacity: 1; }

/* Tint washes */
.bento-card--tint-blue   { background: color-mix(in srgb, var(--tint-blue)   30%, var(--surface)); }
.bento-card--tint-violet { background: color-mix(in srgb, var(--tint-violet) 30%, var(--surface)); }
.bento-card--tint-green  { background: color-mix(in srgb, var(--tint-green)  30%, var(--surface)); }

/* Tint icon wraps */
.bento-card--tint-blue   .card-icon-wrap { background: var(--tint-blue);   }
.bento-card--tint-blue   .card-icon      { color: var(--tint-blue-icon);   }
.bento-card--tint-violet .card-icon-wrap { background: var(--tint-violet); }
.bento-card--tint-violet .card-icon      { color: var(--tint-violet-icon); }
.bento-card--tint-green  .card-icon-wrap { background: var(--tint-green);  }
.bento-card--tint-green  .card-icon      { color: var(--tint-green-icon);  }

.card-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.card-icon {
  width: 18px;
  height: 18px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  line-height: 1.3;
}

.card-body {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Card 1 — Verify stage
   ───────────────────────────────────────────────────────────────────────────── */
.verify-stage {
  position: relative;
  margin-top: 20px;
  flex: 1;
  min-height: 190px;
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* QR layer */
.qr-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.verify-stage--exit .qr-scene,
.verify-stage--cert .qr-scene {
  opacity: 0;
  transform: scale(0.75);
  pointer-events: none;
}

/* Viewfinder */
.viewfinder {
  position: relative;
  width: 92px;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vf-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: var(--tint-blue-icon);
  border-style: solid;
}
.vf-tl { top: 0;    left: 0;  border-width: 2px 0 0 2px; border-radius: 2px 0 0 0; }
.vf-tr { top: 0;    right: 0; border-width: 2px 2px 0 0; border-radius: 0 2px 0 0; }
.vf-bl { bottom: 0; left: 0;  border-width: 0 0 2px 2px; border-radius: 0 0 0 2px; }
.vf-br { bottom: 0; right: 0; border-width: 0 2px 2px 0; border-radius: 0 0 2px 0; }

.qr-svg {
  color: var(--text-primary);
  display: block;
}

/* Scan line */
.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--tint-green-icon) 20%, var(--tint-green-icon) 80%, transparent);
  top: 10px;
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .verify-stage--scanning .scan-line,
  .verify-stage--exit .scan-line {
    animation: scanSweep 0.72s ease forwards;
  }
}

/* Cert reveal layer */
.cert-reveal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
  transition: opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s;
}

.verify-stage--cert .cert-reveal {
  opacity: 1;
  transform: translateY(0);
}

.cert-card-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 16px 20px;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 80%;
  max-width: 196px;
}

.cert-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--tint-green);
  color: var(--tint-green-icon);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.cert-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.cert-course {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.cert-issuer {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
}

.cert-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--status-valid-text);
  background: var(--status-valid-bg);
  padding: 4px 10px;
  border-radius: 999px;
  margin-top: 4px;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.3s ease 0.45s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s;
}

.verify-stage--cert .cert-badge {
  opacity: 1;
  transform: scale(1);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Card 2 — Role stage
   ───────────────────────────────────────────────────────────────────────────── */
.role-stage {
  margin-top: 20px;
  flex: 1;
  min-height: 190px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-windows {
  display: flex;
  gap: 6px;
  flex: 1;
}

.role-window {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--canvas);
  opacity: 0.4;
  transform: scale(1) translateY(0);
  transition: opacity 0.4s ease, transform 0.4s ease;
  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: column;
}

/* Spotlight shadow layer — only opacity transitions (compositor-safe) */
.role-window::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 5px 18px rgba(55, 53, 47, 0.13);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

.role-window--spotlight {
  opacity: 1;
  transform: scale(1.05) translateY(-4px);
  z-index: 1;
}

.role-window--spotlight::after { opacity: 1; }

.role-window--settled {
  opacity: 0.85;
}

/* Titlebar */
.win-titlebar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 6px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.win-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border-strong);
  display: block;
  flex-shrink: 0;
}

.win-title {
  font-size: 9px;
  font-weight: 600;
  margin-left: 2px;
  letter-spacing: 0.02em;
}

.win-tb--green  { background: color-mix(in srgb, var(--tint-green)  60%, var(--canvas)); }
.win-tb--violet { background: color-mix(in srgb, var(--tint-violet) 60%, var(--canvas)); }
.win-tb--blue   { background: color-mix(in srgb, var(--tint-blue)   60%, var(--canvas)); }
.win-tb--green  .win-title { color: var(--tint-green-icon); }
.win-tb--violet .win-title { color: var(--tint-violet-icon); }
.win-tb--blue   .win-title { color: var(--tint-blue-icon); }

/* Window body */
.win-body {
  padding: 6px 5px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.win-body--centered {
  justify-content: center;
}

.win-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  padding: 3px 4px;
  border-radius: 4px;
  background: var(--surface-hover);
}

.win-name {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.win-chip {
  font-size: 8px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.win-chip--green  { background: var(--status-valid-bg);  color: var(--status-valid-text); }
.win-chip--violet { background: var(--tint-violet);       color: var(--tint-violet-icon); }

/* Icon-only chip: the padding above is tuned for text, so shed it here */
.win-chip:has(.win-chip-icon) {
  display: inline-flex;
  align-items: center;
  padding: 2px;
}

.win-chip-icon {
  width: 10px;
  height: 10px;
  display: block;
}

.win-share-icon {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
}

.win-btn {
  font-size: 9px;
  font-weight: 600;
  padding: 3px 5px;
  border-radius: 4px;
  text-align: center;
  margin-top: auto;
}

.win-btn--green {
  background: var(--accent-light);
  color: var(--accent);
}

.win-settings-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  color: var(--text-secondary);
  font-size: 9px;
  margin-top: auto;
}

/* Recipient window content */
.win-cert-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  background: var(--surface-hover);
  border-radius: 5px;
}

.win-cert-badge {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--tint-green);
  color: var(--tint-green-icon);
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.win-cert-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.win-cert-title {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.win-cert-sub {
  font-size: 8px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.win-share {
  font-size: 9px;
  color: var(--tint-blue-icon);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin-top: 6px;
}

/* Caption */
.role-caption {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  min-height: 16px;
  margin: 0;
  line-height: 1.4;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Card 3 — Chain stage
   ───────────────────────────────────────────────────────────────────────────── */
.chain-stage {
  margin-top: 20px;
  flex: 1;
  min-height: 190px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}

/* Row 1: Cert chip */
.chain-cert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface-hover);
  border-radius: 8px;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.chain-cert--visible {
  opacity: 1;
  transform: translateY(0);
}

.chain-cert-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--tint-green);
  color: var(--tint-green-icon);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chain-cert-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chain-cert-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chain-cert-course {
  font-size: 11px;
  color: var(--text-secondary);
  border-radius: 3px;
  padding: 1px 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.25s ease, color 0.25s ease;
}

@media (prefers-reduced-motion: no-preference) {
  .chain-cert-course--highlight {
    animation: editHighlight 0.3s ease both;
  }
}

.chain-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 60px;
  justify-content: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.chain-status--valid {
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
}

.chain-status--invalid {
  background: var(--status-revoked-bg);
  color: var(--status-revoked-text);
}

@media (prefers-reduced-motion: no-preference) {
  .chain-status--invalid {
    animation: chipShake 0.35s ease both;
  }
}

/* Row 2: Hash row */
.chain-hash-row {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chain-hash-row--visible {
  opacity: 1;
}

.chain-hash-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  flex-shrink: 0;
}

.chain-hash {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.chain-hash--good {
  background: var(--tint-blue);
  color: var(--tint-blue-icon);
}

.chain-hash--visible {
  opacity: 1;
  transform: translateY(0);
}

.chain-hash--bad {
  background: var(--status-revoked-bg);
  color: var(--status-revoked-text);
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: no-preference) {
  .chain-hash--bad {
    animation: chainHashIn 0.3s ease both;
  }

  .chain-hash--shake {
    animation: chipShake 0.35s ease both;
  }
}

/* Row 3: Block chain */
.chain-blocks-row {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s ease 0.1s;
}

.chain-blocks-row--visible {
  opacity: 1;
}

.chain-block {
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--tint-green-icon);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tint-green);
  color: var(--tint-green-icon);
  flex-shrink: 0;
  transition: border-color 0.3s ease, background-color 0.3s ease, color 0.3s ease;
}

.chain-connector {
  width: 10px;
  height: 1.5px;
  background: var(--tint-green-icon);
  opacity: 0.45;
  flex-shrink: 0;
}

.chain-connector--new {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chain-connector--visible {
  opacity: 0.45;
}

.chain-block--new {
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
              border-color 0.3s ease, background-color 0.3s ease, color 0.3s ease;
}

.chain-block--sealed {
  opacity: 1;
  transform: scale(1);
}

.chain-block--mismatch {
  border-color: var(--status-revoked-text);
  background: var(--status-revoked-bg);
  color: var(--status-revoked-text);
}

/* ── Keyframes ── */
@keyframes scanSweep {
  from { transform: translateY(0); opacity: 1; }
  70%  { opacity: 0.8; }
  to   { transform: translateY(78px); opacity: 0; }
}

@keyframes editHighlight {
  from { background-color: transparent; color: var(--text-secondary); }
  to   { background-color: var(--tint-amber); color: var(--tint-amber-icon); }
}

@keyframes chipShake {
  0%   { transform: translateX(0);    }
  20%  { transform: translateX(-4px); }
  50%  { transform: translateX(4px);  }
  80%  { transform: translateX(-3px); }
  100% { transform: translateX(0);    }
}

@keyframes chainHashIn {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Reduced-motion: disable all transitions in the stage areas ── */
@media (prefers-reduced-motion: reduce) {
  .qr-scene,
  .cert-reveal,
  .cert-badge,
  .chain-cert,
  .chain-hash,
  .chain-hash-row,
  .chain-blocks-row,
  .chain-block--new,
  .chain-connector--new,
  .role-window {
    transition: none !important;
    animation: none !important;
  }
}

/* ── Credibility line ── */
.features-credibility {
  font-size: 14px;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 40px;
  margin-bottom: 0;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .features {
    padding: 64px 24px;
  }

  .section-headline {
    font-size: 26px;
  }

  .bento {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
