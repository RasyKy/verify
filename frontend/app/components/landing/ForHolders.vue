<template>
  <section id="for-holders" class="holders reveal">
    <div class="holders-inner">
      <!-- ── Copy ── -->
      <div class="holders-copy">
        <div class="section-label">If you were awarded one</div>
        <h2 class="section-headline">Your certificate, in your own account.</h2>
        <p class="holders-sub">
          Certificates are issued to you, not just about you. Claim yours once
          and it lives in a holder account you control — ready to share with an
          employer, and impossible for them to doubt.
        </p>

        <ol class="steps">
          <li v-for="(step, i) in steps" :key="step.title" class="step">
            <span class="step-num" aria-hidden="true">{{ i + 1 }}</span>
            <div>
              <h3 class="step-title">{{ step.title }}</h3>
              <p class="step-body">{{ step.body }}</p>
            </div>
          </li>
        </ol>

        <!--
          No buttons here. Sign-in lives in the sticky header, which stays on
          screen for the whole scroll and routes every role, so a second one
          would compete with it rather than add a way in.

          The note stays: it is not a call to action but the answer to the
          question this section provokes. There is no holder sign-up — an
          account with no certificate attached would mean nothing — so the
          claim link is the only door, and leaving that unsaid sends people
          hunting for a form that does not exist.
        -->
        <p class="actions-note">
          <UIcon name="i-heroicons-envelope" class="note-icon" />
          No account yet? It's created when you open the claim link your
          institution emailed you.
        </p>
      </div>

      <!-- ── The portal, abbreviated. Decorative: every fact it shows is
           stated in the copy beside it. ── -->
      <div class="holders-visual" aria-hidden="true">
        <div class="portal-card">
          <div class="portal-head">
            <div class="avatar">SK</div>
            <div>
              <p class="portal-name">Sophéa Kim</p>
              <p class="portal-meta">2 certificates</p>
            </div>
          </div>

          <div class="cert-row">
            <div class="cert-mark">
              <UIcon name="i-heroicons-academic-cap" />
            </div>
            <div class="cert-text">
              <p class="cert-title">BSc Computer Science</p>
              <p class="cert-org">Royal University of Phnom Penh</p>
            </div>
            <span class="pill pill--public">Public</span>
          </div>

          <div class="cert-row">
            <div class="cert-mark cert-mark--alt">
              <UIcon name="i-heroicons-code-bracket" />
            </div>
            <div class="cert-text">
              <p class="cert-title">Advanced Web Development</p>
              <p class="cert-org">Mekong Coding Academy</p>
            </div>
            <span class="pill pill--hidden">Hidden</span>
          </div>

          <p class="portal-foot">
            <UIcon name="i-heroicons-eye-slash" class="foot-icon" />
            Hiding a certificate removes it from your public profile. It stays
            verifiable by anyone holding its link.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const steps = [
  {
    title: 'Open the claim link',
    body: 'Your institution emails it the moment the certificate is issued. It is addressed to you and works once.',
  },
  {
    title: 'Set up your account',
    body: 'Continue with Google, an emailed code, or a password — whichever you prefer. This is what makes the certificate yours.',
  },
  {
    title: 'Share it, or hide it',
    body: 'Send the link to an employer and they can confirm it in seconds. Hide a certificate and it drops off your public profile without ever becoming unverifiable.',
  },
]
</script>

<style scoped>
.holders {
  padding: 96px 40px;
  background: var(--canvas);
  border-bottom: 1px solid var(--border);
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
}

.holders-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  align-items: center;
}

/* ── Copy ── */
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
  letter-spacing: -0.025em;
  line-height: 1.15;
  color: var(--text-primary);
  margin: 0 0 16px;
}

.holders-sub {
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0 0 32px;
  max-width: 46ch;
}

.steps {
  list-style: none;
  margin: 0 0 24px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.step-num {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--accent-light);
  color: var(--accent-text);
  font-size: 12.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.step-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 3px;
}

.step-body {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0;
  max-width: 44ch;
}

.actions-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-tertiary);
  margin: 0;
  max-width: 40ch;
}

.note-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top: 3px;
}

/* ── Portal mock ── */
/*
 * The watercolour piece is used whole here rather than cropped, because it was
 * drawn as a portrait frame with an empty card in the middle — which is
 * exactly the shape of the mock it sits behind. Cropping it to a band, the way
 * the hero and CTA art is handled, would throw away the only thing that makes
 * it fit.
 *
 * Padding on the wrapper is what reveals the frame: the card is inset far
 * enough for the painted border to show around all four edges.
 */
.holders-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 34px 30px;
  border-radius: var(--radius-panel);
  background-color: #23443F;
  background-image: url('/bg-holders.webp');
  background-size: cover;
  background-position: center;
}

.portal-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-panel);
  /* Deeper than --shadow-panel: the card now floats on a dark ground, where
     the flat-on-white shadow reads as nothing at all. */
  box-shadow: 0 18px 44px -18px rgba(4, 26, 19, 0.55);
  padding: 22px;
}

.portal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--grad-brand);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portal-name {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.portal-meta {
  font-size: 12.5px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
}

.cert-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 10px;
}

.cert-mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--tint-green);
  color: var(--tint-green-icon);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cert-mark :deep(svg) {
  width: 18px;
  height: 18px;
}

.cert-mark--alt {
  background: var(--tint-violet);
  color: var(--tint-violet-icon);
}

.cert-text {
  min-width: 0;
  flex: 1;
}

.cert-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cert-org {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
}

.pill--public {
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
}

.pill--hidden {
  background: var(--surface-hover);
  color: var(--text-tertiary);
}

.portal-foot {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-tertiary);
  margin: 16px 0 0;
}

.foot-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  margin-top: 2px;
}

@media (max-width: 900px) {
  .holders {
    padding: 72px 20px;
  }

  .holders-inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  /* Copy first: the mock illustrates the steps, so it should follow them. */
  .holders-visual {
    order: 2;
    padding: 22px 18px;
    background-image: url('/bg-holders-sm.webp');
  }

  .section-headline {
    font-size: 27px;
  }
}
</style>
