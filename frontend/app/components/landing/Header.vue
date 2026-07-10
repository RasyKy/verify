<template>
  <header class="landing-header">
    <div class="header-inner">
      <a href="/" class="logo-link">
        <div class="logo-badge">
          <span class="logo-letter">V</span>
        </div>
        <span class="wordmark">Verify</span>
      </a>
      <a href="/issuer" class="cta-btn">
        Get started free
      </a>
    </div>
  </header>
</template>

<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--canvas);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 40px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.logo-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-letter {
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
}

.wordmark {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.cta-btn:hover {
  background: var(--accent-text);
}

@media (max-width: 640px) {
  .header-inner {
    padding: 0 20px;
  }
}
</style>
