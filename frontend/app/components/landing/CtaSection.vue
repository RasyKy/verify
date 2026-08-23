<template>
  <section class="cta-section reveal" id="get-started">
    <div class="cta-inner">
      <!--
        Speaks to institutions only. Anyone here to CHECK a certificate was
        served by the hero's search bar before they ever scrolled this far, so
        repeating that action at the foot of the page just split the one CTA
        this section can afford.
      -->
      <h2 class="cta-headline">Issue credentials that verify themselves.</h2>
      <p class="cta-sub">
        Your graduates stop emailing you for confirmation, and employers stop
        waiting on it. Accounts are created by your platform administrator.
      </p>
      <div class="cta-row">
        <a href="/login" class="cta-btn">
          Institution sign in
          <UIcon name="i-heroicons-arrow-right" class="cta-icon" />
        </a>
      </div>
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
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 11px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast),
              border-color var(--transition-fast), color var(--transition-fast);
}

.cta-btn {
  background: var(--grad-brand);
  color: #fff;
  box-shadow: var(--shadow-tile);
}

.cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 26px -12px rgba(10, 92, 82, 0.7);
}

.cta-btn:hover .cta-icon {
  transform: translateX(3px);
}

.cta-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.cta-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .cta-btn:hover {
    transform: none;
  }
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
