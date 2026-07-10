<template>
  <section class="hero reveal">
    <div class="hero-inner">
      <!-- Copy -->
      <div class="hero-copy">
        <h1 class="hero-headline">
          Issue certificates your recipients actually trust.
        </h1>
        <p class="hero-sub">
          Verify lets institutions issue, manage, and revoke digital credentials
          that recipients can share and employers can check instantly — in minutes,
          not days.
        </p>
        <a href="/issuer" class="hero-cta">
          Get started free
        </a>
        <p class="hero-note">No credit card required.</p>
      </div>

      <!-- Certificate card mockup -->
      <div class="hero-visual" aria-hidden="true">
        <div class="cert-card">
          <!-- Card header -->
          <div class="cert-header">
            <div class="cert-issuer">
              <div class="cert-issuer-badge">U</div>
              <span class="cert-issuer-name">University of Phnom Penh</span>
            </div>
            <span class="cert-verified-badge">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Verified
            </span>
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
                  :class="cell.filled ? 'cert-qr-cell--filled' : ''"
                />
              </div>
            </div>
            <div class="cert-id-block">
              <p class="cert-field-label">Certificate ID</p>
              <p class="cert-hash">a3f9e1…c72b</p>
              <p class="cert-chain">Issued via Verify</p>
            </div>
          </div>
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
</script>

<style scoped>
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
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

@media (prefers-reduced-motion: no-preference) {
  .cert-card:hover {
    box-shadow: 0 8px 32px rgba(55, 53, 47, 0.12), 0 2px 8px rgba(55, 53, 47, 0.06);
    transform: translateY(-2px);
  }

  .cert-card:hover .cert-verified-badge {
    animation: verifyPulse 0.35s ease forwards;
  }
}

@keyframes verifyPulse {
  0%   { transform: scale(1);    opacity: 0.8; }
  50%  { transform: scale(1.07); opacity: 1;   }
  100% { transform: scale(1);    opacity: 1;   }
}

.cert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
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

.cert-verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
  font-size: 11px;
  font-weight: 600;
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

/* ── Footer row: QR + hash ── */
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

/* ── Scroll reveal ── */
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(16px);
    animation: fadeUp 0.55s ease forwards;
  }
}

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
