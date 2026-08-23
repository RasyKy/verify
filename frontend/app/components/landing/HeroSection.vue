<script setup lang="ts">
/**
 * The landing hero IS the verification tool.
 *
 * Almost everyone arriving here holds a certificate ID and wants one answer:
 * is this real? Sending them to /verify first added a click and a page load to
 * the only job they came to do, so the search bar lives here and submits
 * straight to /verify/:id. That is also why the header no longer carries a
 * "Verify a certificate" link — you are already on it.
 *
 * The 3D is deliberately small: a shallow parallax on the cards behind the bar
 * and a two-degree tilt on the bar itself. Enough to give the page depth,
 * never enough to compete with the input for attention — and it flattens the
 * moment the field is focused, so nothing moves while someone is typing.
 */
const certId = ref('')
const qrModalOpen = ref(false)
// The search bar owns its own focus styling; the hero tracks focus only to
// freeze the parallax while someone is typing.
const focused = ref(false)

const stageRef = ref<HTMLElement | null>(null)
const reducedMotion = ref(false)
const canParallax = ref(false)

function onSubmit(id: string) {
  navigateTo(`/verify/${encodeURIComponent(id)}`)
}

/**
 * Pointer parallax, written to CSS custom properties rather than inline
 * transforms so each layer can scale the same input by its own depth factor.
 */
function onPointerMove(e: PointerEvent) {
  if (!canParallax.value || reducedMotion.value || focused.value) return
  const el = stageRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
  const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
  el.style.setProperty('--mx', String(Math.max(-1, Math.min(1, x))))
  el.style.setProperty('--my', String(Math.max(-1, Math.min(1, y))))
}

function onPointerLeave() {
  const el = stageRef.value
  if (!el) return
  el.style.setProperty('--mx', '0')
  el.style.setProperty('--my', '0')
}

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  canParallax.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
})
</script>

<template>
  <section
    ref="stageRef"
    class="hero"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <!-- ── Depth layers. Purely decorative: no text a reader would miss. ── -->
    <div class="depth" aria-hidden="true">
      <div class="glow" />
      <div class="card-float card-float--back">
        <div class="cf-line cf-line--sm" />
        <div class="cf-line" />
        <div class="cf-chip" />
      </div>
      <div class="card-float card-float--mid">
        <div class="cf-seal">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6"
                  stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="cf-line cf-line--sm" />
        <div class="cf-line" />
      </div>
      <div class="card-float card-float--front">
        <div class="cf-line cf-line--sm" />
        <div class="cf-line" />
        <div class="cf-chip cf-chip--wide" />
      </div>
      <div class="card-float card-float--low">
        <div class="cf-line cf-line--sm" />
        <div class="cf-line" />
      </div>
    </div>

    <!-- ── Content ── -->
    <div class="hero-inner">
      <p class="eyebrow">Blockchain-anchored credentials</p>

      <h1 class="headline">
        Is this certificate real?<br />
        <span class="headline-accent">Find out in seconds.</span>
      </h1>

      <p class="subline">
        Paste the certificate ID and check it against the blockchain record.
        No account, no waiting on the issuing institution.
      </p>

      <!--
        The one action on this page. focusin/focusout bubble out of the
        component, which is all the hero needs to know to stop the parallax —
        cheaper than an emit the search bar would otherwise carry for one
        caller.
      -->
      <VerifyHeroSearch
        v-model="certId"
        input-id="hero-cert-id"
        tilt
        @focusin="focused = true"
        @focusout="focused = false"
        @submit="onSubmit"
      />

      <div class="under-search">
        <button type="button" class="qr-btn" @click="qrModalOpen = true">
          <UIcon name="i-heroicons-qr-code" class="qr-icon" />
          Scan QR code instead
        </button>
        <span class="dot-sep" aria-hidden="true">·</span>
        <span class="trust-note">
          <UIcon name="i-heroicons-lock-closed" class="trust-icon" />
          Checked against the chain, not a database copy
        </span>
      </div>

      <!--
        Sets the expectation before anyone searches, and gives the composition a
        base wider than the search bar so the hero is not top-heavy. These are
        the four values verifyStatus() can actually return — not marketing.
      -->
      <div class="outcomes">
        <p class="outcomes-label">Every check comes back as one of four</p>
        <ul class="outcome-list">
          <li class="outcome outcome--verified">
            <UIcon name="i-heroicons-check-circle-solid" class="outcome-icon" />
            <span class="outcome-name">Verified</span>
            <span class="outcome-note">Genuine and current</span>
          </li>
          <li class="outcome outcome--revoked">
            <UIcon name="i-heroicons-x-circle-solid" class="outcome-icon" />
            <span class="outcome-name">Revoked</span>
            <span class="outcome-note">Withdrawn by the issuer</span>
          </li>
          <li class="outcome outcome--expired">
            <UIcon name="i-heroicons-clock-solid" class="outcome-icon" />
            <span class="outcome-name">Expired</span>
            <span class="outcome-note">Past its expiry date</span>
          </li>
          <li class="outcome outcome--invalid">
            <UIcon name="i-heroicons-exclamation-triangle-solid" class="outcome-icon" />
            <span class="outcome-name">Invalid</span>
            <span class="outcome-note">Not on the chain</span>
          </li>
        </ul>
      </div>
    </div>

    <VerifyQrScannerModal v-model:open="qrModalOpen" />
  </section>
</template>

<style scoped>
/* ── Stage ── */
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 92px 24px 64px;
  perspective: 1200px;
  --mx: 0;
  --my: 0;
}

.hero-inner {
  position: relative;
  z-index: 2;
  max-width: 780px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Depth layers ── */
.depth {
  position: absolute;
  inset: 0;
  z-index: 1;
  transform-style: preserve-3d;
  pointer-events: none;
}

.glow {
  position: absolute;
  inset: -10%;
  background:
    radial-gradient(680px 420px at 50% 8%, rgba(15, 123, 108, 0.13), transparent 70%),
    radial-gradient(520px 360px at 12% 88%, rgba(92, 170, 160, 0.14), transparent 72%),
    radial-gradient(460px 340px at 88% 78%, rgba(10, 92, 82, 0.10), transparent 72%);
}

/* Floating credential cards. --d is the depth factor: bigger = moves more. */
.card-float {
  position: absolute;
  width: 190px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border);
  box-shadow: 0 18px 40px -22px rgba(55, 53, 47, 0.35);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  gap: 9px;
  transform:
    translate3d(calc(var(--mx) * var(--d) * 14px), calc(var(--my) * var(--d) * 12px), 0)
    rotateX(calc(var(--my) * -2deg))
    rotateY(calc(var(--mx) * 3deg));
  transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

.card-float--back {
  --d: 0.45;
  top: 13%; left: 5%;
  opacity: 0.5;
  scale: 0.84;
}

.card-float--mid {
  --d: 0.8;
  top: 46%; left: 8%;
  opacity: 0.72;
}

.card-float--front {
  --d: 1;
  top: 22%; right: 6%;
  opacity: 0.78;
}

/* Balances the lower right, which the other three left bare. */
.card-float--low {
  --d: 0.62;
  top: 62%; right: 10%;
  opacity: 0.55;
  scale: 0.88;
}

/* Slow vertical drift, offset per card so they never move in lockstep */
@media (prefers-reduced-motion: no-preference) {
  .card-float--back  { animation: drift 13s ease-in-out -2s infinite alternate; }
  .card-float--mid   { animation: drift 16s ease-in-out -7s infinite alternate; }
  .card-float--front { animation: drift 11s ease-in-out -4s infinite alternate; }
  .card-float--low   { animation: drift 15s ease-in-out -9s infinite alternate; }

  @keyframes drift {
    from { margin-top: -10px; }
    to   { margin-top: 10px; }
  }
}

.cf-line {
  height: 7px;
  border-radius: 4px;
  background: var(--border);
}

.cf-line--sm { width: 52%; }

.cf-chip {
  height: 16px;
  width: 58px;
  border-radius: 999px;
  background: var(--status-valid-bg);
}

.cf-chip--wide { width: 78px; }

.cf-seal {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cf-seal svg { width: 17px; height: 17px; }

/* ── Copy ── */
.eyebrow {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 18px;
}

.headline {
  font-size: clamp(34px, 5.2vw, 54px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.032em;
  color: var(--text-primary);
  margin: 0 0 18px;
}

.headline-accent {
  background: linear-gradient(100deg, var(--accent) 0%, #5CAAA0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.subline {
  font-size: 16.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0 0 34px;
  max-width: 30rem;
}

/* ── Under the bar ── */
.under-search {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.qr-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease;
}

.qr-btn:hover {
  border-color: var(--accent);
  color: var(--accent-text);
}

.qr-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.qr-icon { width: 15px; height: 15px; }

.dot-sep { color: var(--text-tertiary); }

.trust-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.trust-icon { width: 13px; height: 13px; }

.outcomes {
  margin-top: 44px;
  width: 100%;
  max-width: 720px;
}

.outcomes-label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0 0 14px;
}

.outcome-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.outcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 14px 10px 13px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(55, 53, 47, 0.04);
}

.outcome-icon {
  width: 19px;
  height: 19px;
  margin-bottom: 3px;
}

.outcome-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.outcome-note {
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--text-tertiary);
  text-align: center;
}

.outcome--verified .outcome-icon { color: var(--status-valid-text); }
.outcome--revoked  .outcome-icon { color: var(--status-revoked-text); }
.outcome--expired  .outcome-icon { color: var(--status-expired-text); }
.outcome--invalid  .outcome-icon { color: var(--status-revoked-text); }

/* ── Reduced motion: no drift ──
   The search bar flattens its own tilt and shake. */
@media (prefers-reduced-motion: reduce) {
  .card-float {
    transform: none;
    transition: none;
  }
}

/* ── Responsive ── */
@media (max-width: 900px) {
  /* The floating cards would sit under the text at this width. */
  .card-float { display: none; }
}

@media (max-width: 720px) {
  .outcome-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .hero { padding: 64px 20px 52px; }

  .outcomes { margin-top: 34px; }

  .outcome {
    flex-direction: row;
    justify-content: flex-start;
    gap: 8px;
    padding: 11px 13px;
  }

  .outcome-icon { margin-bottom: 0; }

  /* The label carries it at this width; the gloss would wrap to three lines. */
  .outcome-note { display: none; }
}
</style>
