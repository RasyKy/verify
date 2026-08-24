<template>
  <section class="cta-section reveal" id="get-started">
    <div class="cta-inner">
      <!--
        A closing statement, not a call to action. Every route this section
        could offer already has a permanent home: the sticky header carries
        sign-in for all three roles the whole way down the page, and anyone
        here to CHECK a certificate was served by the hero's search bar long
        before scrolling this far. Buttons here would restate both.
      -->
      <h2 class="cta-headline">Issue credentials that verify themselves.</h2>
      <p class="cta-sub">
        Your graduates stop emailing you for confirmation, and employers stop
        waiting on it. Accounts are created by your platform administrator.
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
  margin: 0;
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
