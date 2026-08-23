<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <!-- Brand -->
      <div class="footer-brand">
        <div class="footer-logo">
          <BrandLogo :size="28" wordmark />
        </div>
        <p class="footer-tagline">Verifiable credentials for every institution.</p>
        <p class="footer-copy">© {{ year }} Verify. All rights reserved.</p>
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
            <li><a href="/#for-holders" class="footer-link">For certificate holders</a></li>
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
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style scoped>
.site-footer {
  background: var(--canvas);
  border-top: 1px solid var(--border);
  padding: 56px 40px 40px;
}

.footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 64px;
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
  margin: 0 0 16px;
}

.footer-copy {
  font-size: 12px;
  color: var(--text-tertiary);
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
  color: var(--text-tertiary);
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
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.1s ease;
}

.footer-link:hover {
  color: var(--text-primary);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .site-footer {
    padding: 40px 20px 32px;
  }

  .footer-inner {
    flex-direction: column;
    gap: 32px;
  }

  .footer-brand {
    max-width: 100%;
  }
}
</style>
