<template>
  <section class="features reveal">
    <div class="features-inner">
      <div class="section-label">Features</div>
      <h2 class="section-headline">Everything you need to issue credentials at scale.</h2>

      <!-- Bento grid -->
      <div class="bento">
        <!-- Row 1: 2 wide cards -->
        <div class="bento-card bento-card--wide">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-rectangle-stack" class="card-icon" />
          </div>
          <h3 class="card-title">Any credential type</h3>
          <p class="card-body">
            Issue certificates for course completions, exams, workshops, event
            attendance, or membership — one platform covers every format your
            institution needs.
          </p>
          <div class="credential-tags">
            <span v-for="tag in credentialTypes" :key="tag" class="cred-tag">{{ tag }}</span>
          </div>
        </div>

        <div class="bento-card bento-card--wide">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-qr-code" class="card-icon" />
          </div>
          <h3 class="card-title">Instant verification, no account needed</h3>
          <p class="card-body">
            Anyone can verify a certificate by scanning its QR code or visiting a
            direct URL. Recipients share a link, employers check in seconds — no
            logins, no friction.
          </p>
          <div class="verify-demo">
            <div class="verify-url">verify.app/cert/<span class="url-id">a3f9…</span></div>
            <span class="verify-result">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Valid
            </span>
          </div>
        </div>

        <!-- Row 2: 3 narrow cards -->
        <div class="bento-card bento-card--narrow">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-table-cells" class="card-icon" />
          </div>
          <h3 class="card-title">Clean issuer dashboard</h3>
          <p class="card-body">
            Search, filter, revoke, and re-issue from a single table view. No
            spreadsheets, no email chains.
          </p>
        </div>

        <div class="bento-card bento-card--narrow">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-users" class="card-icon" />
          </div>
          <h3 class="card-title">Role-based access</h3>
          <p class="card-body">
            Separate portals for Issuers, Admins, and Recipients — each role sees
            exactly what it needs, nothing more.
          </p>
        </div>

        <div class="bento-card bento-card--narrow">
          <div class="card-icon-wrap">
            <UIcon name="i-heroicons-shield-check" class="card-icon" />
          </div>
          <h3 class="card-title">Tamper-evident certificates</h3>
          <p class="card-body">
            Every certificate is sealed at issuance. Change any detail after the fact
            and verification immediately shows it as invalid — what you issued is
            exactly what the world sees.
          </p>
        </div>
      </div>

      <p class="features-credibility">
        Built for institutions that need to move fast without sacrificing rigour.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
const credentialTypes = [
  'Course completion',
  'Certification / Exam',
  'Workshop',
  'Event attendance',
  'Membership',
]
</script>

<style scoped>
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

/* ── Bento grid ── */
.bento {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto;
  gap: 16px;
}

.bento-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  transition: border-color 0.15s ease;
}

.bento-card:hover {
  border-color: var(--border-strong);
}

.bento-card--wide {
  grid-column: span 1;
}

/* First two wide cards span half the 3-col grid each */
.bento-card--wide:nth-child(1),
.bento-card--wide:nth-child(2) {
  grid-column: span 1;
}

/* Override: row 1 is 2 cols (each card = 1.5 of 3), simulated via template area */
.bento {
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-areas:
    "a a b b"
    "c d e e";
}

/* 4-col trick: redefine */
.bento {
  grid-template-columns: repeat(4, 1fr);
  grid-template-areas:
    "a a b b"
    "c c d e";
  gap: 16px;
}

.bento-card:nth-child(1) { grid-area: a; }
.bento-card:nth-child(2) { grid-area: b; }
.bento-card:nth-child(3) { grid-area: c; }
.bento-card:nth-child(4) { grid-area: d; }
.bento-card:nth-child(5) { grid-area: e; }

/* Reset span classes (grid-areas take over) */
.bento-card--wide,
.bento-card--narrow {
  grid-column: unset;
}

.card-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.card-icon {
  width: 18px;
  height: 18px;
  color: var(--accent);
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

/* ── Credential tags ── */
.credential-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 20px;
}

.cred-tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text-secondary);
  background: var(--canvas);
}

/* ── Verify demo ── */
.verify-demo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 10px 14px;
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.verify-url {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-id {
  color: var(--text-tertiary);
}

.verify-result {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--status-valid-text);
  background: var(--status-valid-bg);
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
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
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "a a"
      "b b"
      "c d"
      "e e";
  }
}

@media (max-width: 560px) {
  .bento {
    grid-template-columns: 1fr;
    grid-template-areas:
      "a"
      "b"
      "c"
      "d"
      "e";
  }
}

/* ── Scroll reveal ── */
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    opacity: 0;
    transform: translateY(16px);
    animation: fadeUp 0.55s ease forwards;
    animation-delay: 0.1s;
  }
}

.features-credibility {
  font-size: 14px;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 40px;
  margin-bottom: 0;
}

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
</style>
