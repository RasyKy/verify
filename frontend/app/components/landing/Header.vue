<template>
  <header class="landing-header">
    <div class="header-inner">
      <a href="/" class="logo-link" aria-label="Verify — home">
        <BrandLogo :size="30" wordmark />
      </a>

      <!--
        Still one action. Verification is what the hero's search bar does, so a
        "Verify a certificate" link here pointed at the page the visitor is
        already on — but sign-in is no longer institution-only: certificate
        holders have accounts too, and /login routes all three roles by itself.
      -->
      <nav class="header-actions">
        <a href="/login" class="solid-btn">
          Sign in
          <UIcon name="i-heroicons-arrow-right" class="btn-icon btn-icon--trail" />
        </a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: saturate(160%) blur(12px);
  border-bottom: 1px solid var(--border);
}

.header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 40px;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-link {
  text-decoration: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.solid-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 15px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast), transform var(--transition-fast);
}

.solid-btn {
  background: var(--grad-brand);
  color: #fff;
  box-shadow: var(--shadow-tile);
}

.solid-btn:hover {
  transform: translateY(-1px);
}

.btn-icon--trail {
  transition: transform var(--transition-fast);
}

.solid-btn:hover .btn-icon--trail {
  transform: translateX(3px);
}

.solid-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .solid-btn:hover,
  .solid-btn:hover .btn-icon--trail {
    transform: none;
  }
}

@media (max-width: 640px) {
  .header-inner {
    padding: 0 20px;
  }
}
</style>
