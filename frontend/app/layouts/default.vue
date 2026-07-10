<template>
  <div class="landing-shell">
    <LandingHeader />
    <main>
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing-shell {
  background: var(--canvas);
  color: var(--text-primary);
  min-height: 100vh;
}
</style>
