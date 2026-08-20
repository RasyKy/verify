<template>
  <header class="landing-header">
    <div class="header-inner">
      <a href="/" class="logo-link">
        <div class="logo-badge">
          <span class="logo-letter">V</span>
        </div>
        <span class="wordmark">Verify</span>
      </a>
      <nav class="header-nav">
        <!-- The primary public action. Verifying needs no account at all
             (FR-AUTH-04, FR-VERIFY-05), and until now the only route to it was
             a link in the footer. -->
        <a href="/verify" class="nav-link" aria-label="Verify a certificate">
          <svg class="nav-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM13 13l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path d="m6.8 9 1.6 1.6L11.4 7.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Verify a certificate
        </a>
        <!-- Institutions receive credentials from an admin; there is no
             self-registration path by design (T-09), so this is "Sign in",
             not "Sign up". -->
        <a href="/login" class="cta-btn">Sign in</a>
      </nav>
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

.header-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.nav-link:hover {
  color: var(--accent-text);
  background: var(--accent-light);
}

.nav-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
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

.cta-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .header-inner {
    padding: 0 20px;
  }

  /* Keep the icon as the affordance and drop the label — "Sign in" is the one
     that must stay legible, and two full labels overflow a phone header. */
  .nav-link {
    font-size: 0;
    padding: 8px;
    gap: 0;
  }

  .nav-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
