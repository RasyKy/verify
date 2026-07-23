<template>
  <section ref="sectionRef" class="audience reveal">
    <div class="audience-inner">
      <p class="audience-eyebrow">Built for</p>
      <h2 class="audience-headline">Every institution that issues credentials.</h2>

      <div class="aud-layout">
        <!-- Selector (tablist) -->
        <div class="aud-selector" role="tablist" aria-label="Audience types">
          <button
            v-for="(item, i) in audiences"
            :key="item.title"
            :ref="(el) => { if (el) tabRefs[i] = el as HTMLButtonElement }"
            class="aud-item"
            :class="[`aud-item--${item.tint}`, { 'aud-item--selected': selectedIndex === i }]"
            role="tab"
            :aria-selected="selectedIndex === i"
            aria-controls="aud-panel"
            :id="`aud-tab-${i}`"
            :tabindex="selectedIndex === i ? 0 : -1"
            @mouseenter="onItemMouseEnter(i)"
            @mouseleave="onItemMouseLeave()"
            @focus="selectAudience(i, { manual: true })"
            @click="selectAudience(i, { manual: true })"
            @keydown.right.prevent="selectAudience((i + 1) % audiences.length, { manual: true, focus: true })"
            @keydown.down.prevent="selectAudience((i + 1) % audiences.length, { manual: true, focus: true })"
            @keydown.left.prevent="selectAudience((i - 1 + audiences.length) % audiences.length, { manual: true, focus: true })"
            @keydown.up.prevent="selectAudience((i - 1 + audiences.length) % audiences.length, { manual: true, focus: true })"
            @keydown.home.prevent="selectAudience(0, { manual: true, focus: true })"
            @keydown.end.prevent="selectAudience(audiences.length - 1, { manual: true, focus: true })"
          >
            <div class="aud-icon-wrap" :class="`aud-icon-wrap--${item.tint}`">
              <UIcon :name="item.icon" class="aud-icon" />
            </div>
            <div class="aud-text">
              <p class="aud-title">{{ item.title }}</p>
              <p class="aud-desc">{{ item.desc }}</p>
            </div>
          </button>
        </div>

        <!-- Preview panel -->
        <div
          id="aud-panel"
          role="tabpanel"
          :aria-labelledby="`aud-tab-${selectedIndex}`"
          tabindex="0"
          class="aud-preview"
          :class="{ 'aud-preview--out': isTransitioning }"
        >
          <div class="prev-card">
            <!-- Header: issuer + verified badge -->
            <div class="prev-header">
              <div class="prev-issuer">
                <div class="prev-issuer-badge" :class="`prev-issuer-badge--${currentTint}`">
                  {{ currentCard.issuerLetter }}
                </div>
                <span class="prev-issuer-name">{{ currentCard.issuerName }}</span>
              </div>
              <span class="prev-verified-badge">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Verified
              </span>
            </div>

            <div class="prev-divider" />

            <p class="prev-cert-type">{{ currentCard.certType }}</p>

            <div class="prev-recipient-block">
              <p class="prev-field-label">Awarded to</p>
              <p class="prev-recipient-name">{{ currentCard.recipient }}</p>
            </div>

            <div class="prev-meta">
              <div v-for="f in currentCard.fields" :key="f.label">
                <p class="prev-field-label">{{ f.label }}</p>
                <p class="prev-field-value">{{ f.value }}</p>
              </div>
            </div>

            <div class="prev-footer">
              <p class="prev-field-label">Issued via</p>
              <p class="prev-footer-tag">{{ currentCard.footerTag }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const audiences = [
  {
    icon: 'i-heroicons-academic-cap',
    title: 'Universities & colleges',
    desc: 'Degrees, diplomas, course completions',
    tint: 'green',
    card: {
      issuerLetter: 'M',
      issuerName: 'Mekong University',
      certType: "Bachelor's Degree",
      recipient: 'Sopheap Chan',
      fields: [
        { label: 'Programme', value: 'Computer Science' },
        { label: 'Class of',  value: '2026' },
      ],
      footerTag: 'Degree Certificate',
    },
  },
  {
    icon: 'i-heroicons-code-bracket-square',
    title: 'Bootcamps & training centers',
    desc: 'Programme certificates, skill badges',
    tint: 'blue',
    card: {
      issuerLetter: 'C',
      issuerName: 'CodeBridge Cambodia',
      certType: 'Programme Certificate',
      recipient: 'Virak Phat',
      fields: [
        { label: 'Programme', value: 'Full-Stack Web Development' },
        { label: 'Completed', value: 'May 2026' },
      ],
      footerTag: 'Cohort 14',
    },
  },
  {
    icon: 'i-heroicons-briefcase',
    title: 'Professional bodies',
    desc: 'Certifications, exam passes, renewals',
    tint: 'violet',
    card: {
      issuerLetter: 'P',
      issuerName: 'PMA Cambodia Chapter',
      certType: 'Professional Certification',
      recipient: 'Daro Keo',
      fields: [
        { label: 'Credential ID', value: 'CPP-2026-0481' },
        { label: 'Valid until',   value: 'Dec 2028' },
      ],
      footerTag: 'Certified Project Practitioner',
    },
  },
  {
    icon: 'i-heroicons-calendar-days',
    title: 'Event organizers',
    desc: 'Attendance, speaker, volunteer recognition',
    tint: 'amber',
    card: {
      issuerLetter: 'T',
      issuerName: 'TechFest Phnom Penh',
      certType: 'Event Recognition',
      recipient: 'Lina Mok',
      fields: [
        { label: 'Role',       value: 'Speaker' },
        { label: 'Event date', value: 'Jun 14, 2026' },
      ],
      footerTag: 'Tech Summit 2026',
    },
  },
]

// Refs
const sectionRef = ref<HTMLElement | null>(null)
const tabRefs    = ref<HTMLButtonElement[]>([])

// State
const selectedIndex        = ref(0)
const isTransitioning      = ref(false)
const hasInteracted        = ref(false)
const prefersReducedMotion = ref(false)
const canHover             = ref(false)

let isVisible  = false
let autoTimer: ReturnType<typeof setTimeout> | null = null
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const currentCard = computed(() => audiences[selectedIndex.value].card)
const currentTint = computed(() => audiences[selectedIndex.value].tint)

// ── Hover-to-select (desktop with fine pointer only) ──────────────────────

function clearHoverTimer() {
  if (hoverTimer !== null) { clearTimeout(hoverTimer); hoverTimer = null }
}

function onItemMouseEnter(index: number) {
  if (!canHover.value) return
  clearHoverTimer()
  hoverTimer = setTimeout(() => selectAudience(index, { manual: true }), 120)
}

function onItemMouseLeave() {
  if (!canHover.value) return
  clearHoverTimer()
}

// ── Interaction ────────────────────────────────────────────────────────────

async function selectAudience(index: number, opts: { manual?: boolean; focus?: boolean } = {}) {
  if (opts.manual) {
    hasInteracted.value = true
    stopAutoAdvance()
  }
  if (index === selectedIndex.value || isTransitioning.value) return

  if (prefersReducedMotion.value) {
    selectedIndex.value = index
    if (opts.focus) {
      await nextTick()
      tabRefs.value[index]?.focus()
    }
    return
  }

  isTransitioning.value = true
  await new Promise<void>(r => setTimeout(r, 165))
  selectedIndex.value = index
  await nextTick()
  isTransitioning.value = false

  if (opts.focus) tabRefs.value[index]?.focus()
}

// ── Auto-advance ───────────────────────────────────────────────────────────

function stopAutoAdvance() {
  if (autoTimer !== null) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
}

function scheduleAutoAdvance() {
  stopAutoAdvance()
  if (hasInteracted.value || !isVisible || prefersReducedMotion.value) return
  autoTimer = setTimeout(async () => {
    if (!hasInteracted.value && isVisible) {
      await selectAudience((selectedIndex.value + 1) % audiences.length)
      scheduleAutoAdvance()
    }
  }, 5000)
}

// ── Shared IO ─────────────────────────────────────────────────────────────────
useIntersect(sectionRef, (entry) => {
  isVisible = entry.isIntersecting
  if (isVisible) scheduleAutoAdvance()
  else stopAutoAdvance()
})

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  canHover.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
})

onUnmounted(() => { stopAutoAdvance(); clearHoverTimer() })
</script>

<style scoped>
/* ── Section ── */
.audience {
  padding: 72px 40px;
  border-top: 1px solid var(--border);
}

.audience-inner {
  max-width: 1120px;
  margin: 0 auto;
}

.audience-eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 12px;
}

.audience-headline {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.25;
  margin: 0 0 40px;
}

/* ── Two-column layout ── */
.aud-layout {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 40px;
  align-items: start;
}

/* ── Selector (vertical tablist) ── */
.aud-selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aud-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  font-family: inherit;
}

.aud-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.aud-item:not(.aud-item--selected):hover {
  background: var(--surface-hover);
}

/* Selected states — tint wash + left border */
.aud-item--selected.aud-item--green  { background: color-mix(in srgb, var(--tint-green)  45%, transparent); border-left-color: var(--tint-green-icon);  }
.aud-item--selected.aud-item--blue   { background: color-mix(in srgb, var(--tint-blue)   45%, transparent); border-left-color: var(--tint-blue-icon);   }
.aud-item--selected.aud-item--violet { background: color-mix(in srgb, var(--tint-violet) 45%, transparent); border-left-color: var(--tint-violet-icon); }
.aud-item--selected.aud-item--amber  { background: color-mix(in srgb, var(--tint-amber)  45%, transparent); border-left-color: var(--tint-amber-icon);  }

/* Icon wraps */
.aud-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.aud-icon {
  width: 18px;
  height: 18px;
}

.aud-icon-wrap--green  { background: var(--tint-green);  }
.aud-icon-wrap--green  .aud-icon { color: var(--tint-green-icon);  }
.aud-icon-wrap--blue   { background: var(--tint-blue);   }
.aud-icon-wrap--blue   .aud-icon { color: var(--tint-blue-icon);   }
.aud-icon-wrap--violet { background: var(--tint-violet); }
.aud-icon-wrap--violet .aud-icon { color: var(--tint-violet-icon); }
.aud-icon-wrap--amber  { background: var(--tint-amber);  }
.aud-icon-wrap--amber  .aud-icon { color: var(--tint-amber-icon);  }

.aud-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aud-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.aud-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.45;
  margin: 0;
}

/* ── Preview panel ── */
.aud-preview {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.aud-preview:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 14px;
}

.aud-preview--out {
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* ── Credential preview card ── */
.prev-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(55, 53, 47, 0.07), 0 1px 4px rgba(55, 53, 47, 0.04);
  min-height: 280px;
}

.prev-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.prev-issuer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prev-issuer-badge {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.prev-issuer-badge--green  { background: var(--tint-green);  color: var(--tint-green-icon);  }
.prev-issuer-badge--blue   { background: var(--tint-blue);   color: var(--tint-blue-icon);   }
.prev-issuer-badge--violet { background: var(--tint-violet); color: var(--tint-violet-icon); }
.prev-issuer-badge--amber  { background: var(--tint-amber);  color: var(--tint-amber-icon);  }

.prev-issuer-name {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.prev-verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
  font-size: 11px;
  font-weight: 600;
}

.prev-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 16px;
}

.prev-cert-type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin: 0 0 12px;
}

.prev-recipient-block {
  margin-bottom: 16px;
}

.prev-field-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0 0 2px;
}

.prev-recipient-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.prev-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.prev-field-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.prev-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.prev-footer-tag {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

/* ── Mobile: horizontal scrollable pills ── */
@media (max-width: 860px) {
  .audience {
    padding: 56px 24px;
  }

  .audience-headline {
    font-size: 22px;
    margin-bottom: 28px;
  }

  .aud-layout {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .aud-selector {
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
    padding-bottom: 4px;
    scrollbar-width: none;
  }

  .aud-selector::-webkit-scrollbar {
    display: none;
  }

  .aud-item {
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: auto;
    min-width: 110px;
    text-align: center;
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 8px;
    gap: 8px;
  }

  /* Border moves to bottom on mobile */
  .aud-item--selected.aud-item--green  { border-left-color: transparent; border-bottom-color: var(--tint-green-icon);  }
  .aud-item--selected.aud-item--blue   { border-left-color: transparent; border-bottom-color: var(--tint-blue-icon);   }
  .aud-item--selected.aud-item--violet { border-left-color: transparent; border-bottom-color: var(--tint-violet-icon); }
  .aud-item--selected.aud-item--amber  { border-left-color: transparent; border-bottom-color: var(--tint-amber-icon);  }

  .aud-desc {
    display: none;
  }
}

@media (max-width: 480px) {
  .aud-item {
    min-width: 96px;
  }
}
</style>
