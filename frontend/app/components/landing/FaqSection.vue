<template>
  <section class="faq reveal">
    <div class="faq-inner">
      <div class="section-label">FAQ</div>
      <h2 class="section-headline">Frequently asked questions.</h2>

      <div class="faq-list">
        <details v-for="item in faqs" :key="item.q" class="faq-item">
          <summary class="faq-summary">
            <span class="faq-q">{{ item.q }}</span>
            <span class="faq-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </summary>
          <p class="faq-a">{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const faqs = useFaqs()
</script>

<style scoped>
.faq {
  padding: 96px 40px;
  content-visibility: auto;
  contain-intrinsic-size: auto 400px;
}

.faq-inner {
  max-width: 640px;
  margin: 0 auto;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
  text-align: center;
}

.section-headline {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 48px;
  text-align: center;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Each question is its own rounded, filled card rather than a row in a
   hairline-divided list — closed items read as a stack of quiet chips,
   the open one reads as a distinct panel instead of just more list text. */
.faq-item {
  background: var(--surface-hover);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.faq-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.faq-summary::-webkit-details-marker {
  display: none;
}

.faq-q {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.faq-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
}

.faq-item[open] .faq-chevron {
  transform: rotate(180deg);
}

.faq-a {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin: 0;
  padding: 0 24px 22px;
}

/* Disable chevron animation for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  .faq-chevron {
    transition: none;
  }
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .faq {
    padding: 64px 24px;
  }

  .section-headline {
    font-size: 26px;
  }

  .faq-summary {
    padding: 16px 18px;
  }

  .faq-a {
    padding: 0 18px 18px;
  }
}


</style>
