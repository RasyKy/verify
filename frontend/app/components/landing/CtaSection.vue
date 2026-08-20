<template>
  <section class="cta-section reveal" id="get-started">
    <div class="cta-inner">
      <h2 class="cta-headline">Ready to issue your first certificate?</h2>
      <!-- Deliberately not "set up in minutes": institutions are vetted by a
           human before an issuer account exists (T-09). Promising instant
           self-serve setup here would be a promise the product cannot keep. -->
      <p class="cta-sub">
        Issuer accounts are created by our team once your institution is
        verified. Tell us about yours and we will set you up.
      </p>
      <a href="mailto:hello@verify.app?subject=Issuer%20access%20request" class="cta-btn">
        Request issuer access
      </a>
      <p class="cta-note">
        Already have an account? <a href="/login" class="cta-note-link">Sign in</a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.cta-section {
  background: var(--surface-hover);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 88px 40px;
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}

.cta-inner {
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cta-headline {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 12px;
}

.cta-sub {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 32px;
  max-width: 460px;
  line-height: 1.6;
}

.cta-note {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 16px 0 0;
}

.cta-note-link {
  color: var(--accent-text);
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}

.cta-note-link:hover {
  border-bottom-color: var(--accent);
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  padding: 13px 28px;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.cta-btn:hover {
  background: var(--accent-text);
}

.cta-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .cta-section {
    padding: 64px 24px;
  }

  .cta-headline {
    font-size: 26px;
  }
}
</style>
