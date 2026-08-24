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
/*
 * The closing panel is the one place on the page that goes dark, which is why
 * the scrapbook texture lands here: it is a near-uniform paper grain, so it
 * survives being cropped to any viewport width, unlike the two framed pieces.
 *
 * `background-color` is set as well as the image and matches the texture's
 * mid-tone. If the WebP has not decoded yet — or ever fails to — the white
 * text below lands on solid green rather than on the light surface it used to
 * sit on, which would make the whole section unreadable for that moment.
 *
 * The overlay is not decoration, it is the contrast budget. Measured against
 * the LIGHTEST pixel in the texture — rgb(136,163,122), which is where white
 * text is worst off, not the average — the raw art gives only 2.78:1. The
 * scrim below takes that to 6.40:1 for the headline and 5.26:1 for the sub,
 * both clear of WCAG AA (3:1 large, 4.5:1 body).
 */
.cta-section {
  position: relative;
  isolation: isolate;
  background-color: #3F5C38;
  background-image: url('/bg-cta.webp');
  background-size: cover;
  background-position: center;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 88px 40px;
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}

.cta-section::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(180deg, rgba(8, 42, 30, 0.5) 0%, rgba(5, 33, 24, 0.62) 100%);
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

@media (max-width: 640px) {
  .cta-section {
    padding: 64px 24px;
    background-image: url('/bg-cta-sm.webp');
  }

  .cta-headline {
    font-size: 26px;
  }
}
</style>
