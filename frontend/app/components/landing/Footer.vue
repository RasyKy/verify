<template>
  <footer class="site-footer">
    <div class="footer-main">
      <!-- Brand -->
      <div class="footer-brand">
        <div class="footer-logo">
          <BrandLogo :size="28" wordmark />
        </div>
        <p class="footer-tagline">Verifiable credentials for every institution.</p>
      </div>

      <!-- Links -->
      <div class="footer-links">
        <div class="link-col">
          <p class="link-col-label">Product</p>
          <ul class="link-list">
            <li><a href="/verify" class="footer-link">Verify a certificate</a></li>
            <li><a href="/issuer" class="footer-link">Issuer portal</a></li>
            <li>
              <a href="/login?redirect=/recipient" class="footer-link">
                Holder portal
              </a>
            </li>
          </ul>
        </div>
        <div class="link-col">
          <p class="link-col-label">Company</p>
          <ul class="link-list">
            <li><a href="/contact" class="footer-link">Contact</a></li>
            <li><a href="/#for-holders" class="footer-link">For certificate recipients</a></li>
          </ul>
        </div>
        <div class="link-col">
          <p class="link-col-label">Legal</p>
          <ul class="link-list">
            <li><a href="/terms" class="footer-link">Terms of service</a></li>
            <li><a href="/privacy" class="footer-link">Privacy policy</a></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- A second, quieter band below a hairline: the standard closing bar on
         a light footer (Apple, Coursera). Repeating Terms/Privacy here is a
         click away without scrolling back up to the Legal column. -->
    <div class="footer-bottom">
      <p class="footer-copy">© {{ year }} Verify. All rights reserved.</p>
      <ul class="footer-legal">
        <li><a href="/terms" class="footer-link">Terms</a></li>
        <li><a href="/privacy" class="footer-link">Privacy</a></li>
      </ul>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style scoped>
/*
 * Light, like the rest of the page. An earlier pass made this footer dark
 * brand-teal to give the page "a deliberate close" — but every other section
 * here is light, and a dark footer directly under the CTA band's own dark
 * texture read as two near-matching darks meeting at a seam, not as one
 * considered surface. The CTA band (CtaSection.vue) is now the page's one
 * dark moment; the footer goes back to being what a light page's footer
 * usually is — a quiet, slightly-tinted close, not a second dark block.
 *
 * `--canvas-app` rather than `--canvas`/`--surface` (pure white): a step
 * warmer/greyer than the page above it, enough to read as its own surface
 * without introducing a new colour — the same token the dashboard already
 * uses as a tinted ground under white cards.
 *
 * Text uses the site's standard `--text-*` scale, not the portal's dark-only
 * `--footer-*` tokens (design-tokens.css) — those exist for ui/Footer.vue,
 * which stays dark on the recipient portal and is unrelated to this page.
 */
.site-footer {
  background: var(--canvas-app);
  color: var(--text-primary);
  padding: 40px 40px 32px;
}

/*
 * Clustered from the left rather than `space-between`: with only two
 * children (brand block, link columns) space-between pins them to opposite
 * edges of the shared 1120px column and leaves a dead gap in the middle.
 * Clustering keeps the same shared left edge as every other section while
 * letting unused width fall to the right as ordinary margin instead.
 */
.footer-main {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 72px;
  flex-wrap: wrap;
}

/* ── Brand ── */
.footer-brand {
  max-width: 280px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.footer-tagline {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 0;
}

/* ── Links ── */
.footer-links {
  display: flex;
  gap: 56px;
}

.link-col-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.link-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-link {
  font-size: 14px;
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.1s ease;
}

.footer-link:hover {
  color: var(--accent-text);
}

/* ── Bottom bar ── */
.footer-bottom {
  max-width: 1120px;
  margin: 28px auto 0;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-copy {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.footer-legal {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 20px;
}

.footer-legal .footer-link {
  font-size: 12px;
  color: var(--text-secondary);
}

.footer-legal .footer-link:hover {
  color: var(--accent-text);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .site-footer {
    padding: 32px 20px 24px;
  }

  .footer-main {
    flex-direction: column;
    gap: 28px;
  }

  .footer-brand {
    max-width: 100%;
  }

  .footer-bottom {
    margin-top: 24px;
    padding-top: 16px;
  }
}
</style>
