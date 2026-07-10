<template>
  <section class="cta-section" id="get-started">
    <div class="cta-inner">
      <h2 class="cta-headline">Ready to issue your first certificate?</h2>
      <p class="cta-sub">No credit card required. Set up in minutes.</p>
      <a href="/issuer" class="cta-btn">
        Get started free
      </a>
    </div>
  </section>
</template>

<style scoped>
.cta-section {
  background: color-mix(in srgb, var(--accent-light) 18%, var(--canvas));
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 88px 40px;
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

@media (max-width: 640px) {
  .cta-section {
    padding: 64px 24px;
  }

  .cta-headline {
    font-size: 26px;
  }
}
</style>
