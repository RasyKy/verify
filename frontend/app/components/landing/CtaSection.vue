<template>
  <section class="cta-section reveal" id="get-started">
    <div class="cta-inner">
      <h2 class="cta-headline">Issue credentials that verify themselves.</h2>
      <p class="cta-sub">
        Your graduates stop emailing you for confirmation, and employers stop
        waiting on it — every certificate proves itself the moment someone
        checks it.
      </p>

      <!--
        Two actions, not one: this is the closing panel of a page two
        different visitors reach by scrolling all the way down. An
        institution convinced by the pitch above has no self-serve signup to
        land on (accounts are provisioned by the platform team), so its path
        is a conversation — "Get in touch". Someone who scrolled this far
        still holding a certificate ID gets the hero's own action offered
        back to them rather than a dead end. Sign-in isn't repeated here: the
        sticky header already carries it the entire way down the page.
      -->
      <div class="cta-actions">
        <a href="/contact" class="cta-btn cta-btn--primary">
          Get in touch
          <UIcon name="i-heroicons-arrow-right" class="btn-icon" />
        </a>
        <a href="/verify" class="cta-btn cta-btn--ghost">Verify a certificate</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * The closing panel is the one place on the page that goes dark — the page's
 * single deliberate bookend, not a transition toward another dark surface.
 * The footer directly below (landing/Footer.vue) is light, so this section
 * ends in a clean, high-contrast hard cut: no gradient or fade reaching down
 * into it. That cut needs no extra CSS of its own — it falls out naturally
 * once this panel isn't trying to color-match anything below it.
 *
 * The scrapbook texture is a near-uniform paper grain, so it survives being
 * cropped to any viewport width, unlike the two framed illustration pieces
 * elsewhere on the page. `background-color` matches its mid-tone as a
 * fallback for the moment before the WebP decodes (or if it never does) —
 * without it the white text below would land on the light surface this used
 * to be, unreadable for that moment.
 *
 * The overlay is the contrast budget, not a color-matching bridge: it
 * deepens within its own dark-green family (not toward any other section's
 * color) purely to keep the grain visible while still holding the text
 * readable. Measured against the texture's LIGHTEST sampled pixel —
 * rgb(136,163,122), the worst case for white text, at the top stop (also the
 * worst case) — the composited background is rgb(72,112,89): headline
 * 5.62:1, sub 4.65:1, both clear of WCAG AA (3:1 large, 4.5:1 body).
 */
.cta-section {
  position: relative;
  isolation: isolate;
  background-color: var(--color-teal-800);
  background-image: url('/bg-cta.webp');
  background-size: cover;
  background-position: center;
  padding: 96px 40px;
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}

.cta-section::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(180deg, rgba(8, 61, 55, 0.50) 0%, rgba(4, 28, 24, 0.72) 100%);
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
  color: #FFFFFF;
  text-shadow: 0 1px 2px rgba(4, 26, 19, 0.35);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 12px;
}

.cta-sub {
  font-size: 15px;
  /* Not --text-secondary: that is a grey tuned for white surfaces and drops to
     roughly 2:1 here. This is white held back just enough to stay secondary. */
  color: rgba(255, 255, 255, 0.86);
  margin: 0;
}

/* ── Actions ── */
.cta-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 22px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast), transform var(--transition-fast);
}

/* Solid white, not the brand gradient the header uses: on this dark ground a
   white fill is what reads as "the one to press", and it borrows the same
   trick the ghost button's neighbor relies on — maximum contrast, minimum
   competition with the teal surface around it. */
.cta-btn--primary {
  background: #FFFFFF;
  color: var(--accent-text);
  box-shadow: 0 10px 22px -12px rgba(2, 15, 12, 0.55);
}

.cta-btn--primary:hover {
  transform: translateY(-1px);
}

.cta-btn--ghost {
  background: transparent;
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.32);
}

.cta-btn--ghost:hover {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.06);
}

.cta-btn:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 3px;
}

.btn-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cta-btn--primary:hover {
    transform: none;
  }
}

@media (max-width: 640px) {
  .cta-section {
    padding: 72px 24px;
    background-image: url('/bg-cta-sm.webp');
  }

  .cta-headline {
    font-size: 26px;
  }

  .cta-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .cta-btn {
    justify-content: center;
  }
}
</style>
