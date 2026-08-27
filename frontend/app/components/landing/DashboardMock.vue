<template>
  <section ref="dashRef" class="dash reveal">
    <div class="dash-inner">
      <!-- Copy -->
      <div class="dash-copy">
        <p class="section-label">Dashboard</p>
        <h2 class="section-headline">Issue and manage from one place.</h2>
        <p class="section-body">
          Search, filter, and revoke certificates in seconds. No spreadsheets,
          no email threads. Everything your institution needs in a single view.
        </p>
      </div>

      <!-- Screen reader description of the demo -->
      <span class="sr-only">
        Demo: an issuer clicks "Issue certificate", a form opens, types a recipient name and course,
        clicks Issue, and a valid credential appears in the table within seconds.
      </span>

      <!-- Browser mock (fully decorative) -->
      <div aria-hidden="true" class="browser">
        <!-- Chrome bar -->
        <div class="browser-chrome">
          <div class="browser-dots">
            <span class="dot dot--red" />
            <span class="dot dot--yellow" />
            <span class="dot dot--green" />
          </div>
          <div class="browser-url">verify.app/issuer/certificates</div>
        </div>

        <!-- UI content -->
        <div ref="browserBodyRef" class="browser-body">
          <!-- Fake cursor (hidden when reduced motion) -->
          <div
            v-if="!prefersReducedMotion"
            class="fake-cursor"
            :style="{ transform: `translate(${cursorX}px, ${cursorY}px)`, transition: cursorTransition }"
          >
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
              <path d="M1.5 1.5l11 6.5-5.5 1.5-3 6.5z" fill="#37352F" stroke="white" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
          </div>

          <!-- Page header: title + the real page's own "Issue certificate" button -->
          <div class="ui-header">
            <div>
              <p class="ui-page-title">Certificates</p>
              <p class="ui-page-subtitle">View, search, and manage all issued certificates.</p>
            </div>
            <div
              ref="issueBtnRef"
              class="ui-issue-btn"
              :class="{ 'ui-issue-btn--hovered': btnHovered, 'ui-issue-btn--pressed': btnPressed }"
            >
              <UIcon name="i-heroicons-plus" class="ui-issue-icon" />
              Issue certificate
            </div>
          </div>

          <!-- Filter bar -->
          <div class="ui-toolbar">
            <div class="ui-search">
              <UIcon name="i-heroicons-magnifying-glass" class="ui-search-icon" />
              <span class="ui-search-placeholder">Search by student name or certificate ID…</span>
            </div>
            <div class="ui-status-select">
              All statuses
              <UIcon name="i-heroicons-chevron-down" class="ui-status-chevron" />
            </div>
          </div>

          <!-- Table -->
          <table class="ui-table">
            <thead>
              <tr>
                <th>Recipient name</th>
                <th>Course</th>
                <th>Completion date</th>
                <th>Status</th>
                <th class="th-actions" />
              </tr>
            </thead>
            <tbody>
              <!-- Animated new row (slides in, then fades out on loop reset) -->
              <tr
                v-if="newRow"
                class="table-row--new"
                :class="{ 'table-row--visible': newRowVisible }"
              >
                <td class="td-name">Chanlina Meas</td>
                <td class="td-course">Graphic Design</td>
                <td class="td-date">Jul 10, 2026</td>
                <td>
                  <span
                    class="status-chip"
                    :class="`status-chip--${newRowStatus.toLowerCase()}`"
                  >{{ newRowStatus }}</span>
                </td>
                <td />
              </tr>
              <!-- Static rows -->
              <tr v-for="row in rows" :key="row.name">
                <td class="td-name">{{ row.name }}</td>
                <td class="td-course">{{ row.course }}</td>
                <td class="td-date">{{ row.date }}</td>
                <td>
                  <span class="status-chip" :class="`status-chip--${row.status.toLowerCase()}`">
                    {{ row.status }}
                  </span>
                </td>
                <td class="td-actions">
                  <span class="ui-row-actions">
                    <UIcon name="i-heroicons-eye" class="ui-row-action" />
                    <UIcon name="i-heroicons-pencil-square" class="ui-row-action" />
                    <UIcon
                      v-if="row.status !== 'Revoked'"
                      name="i-heroicons-no-symbol"
                      class="ui-row-action ui-row-action--danger"
                    />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Issue-certificate modal, matching the real page: a centered dialog
               over a dimmed backdrop, not an inline form under the toolbar. -->
          <div class="ui-modal-overlay" :class="{ 'ui-modal-overlay--open': showForm }">
            <div class="ui-modal">
              <p class="ui-modal-title">Issue certificate</p>
              <div class="inline-fields">
                <div class="inline-field">
                  <span class="inline-label">Recipient name</span>
                  <div ref="nameFieldRef" class="inline-input">
                    {{ typedName }}<span v-if="activeField === 'name'" class="cursor-blink" />
                  </div>
                </div>
                <div class="inline-field">
                  <span class="inline-label">Course</span>
                  <div ref="courseFieldRef" class="inline-input">
                    {{ typedCourse }}<span v-if="activeField === 'course'" class="cursor-blink" />
                  </div>
                </div>
              </div>
              <div class="inline-actions">
                <button
                  ref="confirmBtnRef"
                  type="button"
                  class="inline-issue-btn"
                  :class="{ 'inline-issue-btn--hovered': confirmHovered, 'inline-issue-btn--pressed': confirmPressed }"
                >
                  Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const rows = [
  { name: 'Sarah Kimura',  course: 'Web Development',    date: 'Jun 12, 2025', status: 'Valid'   },
  { name: 'James Okonkwo', course: 'Data Analytics',     date: 'May 30, 2025', status: 'Valid'   },
  { name: 'Anya Petrov',   course: 'UX Design',          date: 'Apr 18, 2025', status: 'Revoked' },
  { name: 'Lim Sokha',     course: 'Project Management', date: 'Mar 5, 2025',  status: 'Valid'   },
]

// Template refs
const dashRef        = ref<HTMLElement | null>(null)
const browserBodyRef = ref<HTMLElement | null>(null)
const issueBtnRef    = ref<HTMLElement | null>(null)
const nameFieldRef   = ref<HTMLElement | null>(null)
const courseFieldRef = ref<HTMLElement | null>(null)
const confirmBtnRef  = ref<HTMLElement | null>(null)

// Reduced motion
const prefersReducedMotion = ref(false)

// Cursor
const cursorX          = ref(20)
const cursorY          = ref(100)
const cursorTransition = ref('none')

// Form
const showForm   = ref(false)
const typedName  = ref('')
const typedCourse = ref('')
const activeField = ref<'name' | 'course' | null>(null)

// Button states
const btnHovered     = ref(false)
const btnPressed     = ref(false)
const confirmHovered = ref(false)
const confirmPressed = ref(false)

// Animated row
const newRow        = ref(false)
const newRowVisible = ref(false)
const newRowStatus  = ref<'Pending' | 'Valid'>('Pending')

// ── Timeline primitives ────────────────────────────────────────────────────

type Ctrl = { aborted: boolean }

function sleep(ms: number, ctrl: Ctrl): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (ctrl.aborted) { reject(new Error('aborted')); return }
    const id = setTimeout(() => {
      ctrl.aborted ? reject(new Error('aborted')) : resolve()
    }, ms)
    // Store cancel handle on ctrl so callers can abort a running timer
    ;(ctrl as any)._cancel?.()
    ;(ctrl as any)._cancel = () => { clearTimeout(id); reject(new Error('aborted')) }
  })
}

async function moveCursor(x: number, y: number, ctrl: Ctrl, duration = 650) {
  cursorTransition.value = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
  cursorX.value = x
  cursorY.value = y
  await sleep(duration + 50, ctrl)
}

async function typeText(target: Ref<string>, text: string, ctrl: Ctrl) {
  for (const char of text) {
    if (ctrl.aborted) throw new Error('aborted')
    target.value += char
    await sleep(40 + Math.random() * 40, ctrl)
  }
}

function getPos(el: HTMLElement | null): { x: number; y: number } {
  if (!el || !browserBodyRef.value) return { x: 20, y: 20 }
  const body = browserBodyRef.value.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left - body.left + rect.width / 2,
    y: rect.top  - body.top  + rect.height / 2,
  }
}

// ── Scene ──────────────────────────────────────────────────────────────────

async function runScene(ctrl: Ctrl) {
  // ① Reset
  typedName.value    = ''
  typedCourse.value  = ''
  showForm.value     = false
  newRow.value       = false
  newRowVisible.value = false
  newRowStatus.value = 'Pending'
  btnHovered.value   = false
  btnPressed.value   = false
  confirmHovered.value = false
  confirmPressed.value = false
  activeField.value  = null
  cursorTransition.value = 'none'
  cursorX.value = 20
  cursorY.value = 100
  await sleep(700, ctrl)

  // ② Cursor → Issue certificate button
  const btnPos = getPos(issueBtnRef.value)
  await moveCursor(btnPos.x, btnPos.y, ctrl)
  btnHovered.value = true
  await sleep(400, ctrl)
  btnPressed.value = true
  await sleep(120, ctrl)
  btnPressed.value  = false
  btnHovered.value  = false
  await sleep(200, ctrl)

  // ③ Modal opens
  showForm.value = true
  await sleep(480, ctrl)
  await nextTick()

  // ④ Cursor → name field → type
  const namePos = getPos(nameFieldRef.value)
  await moveCursor(namePos.x, namePos.y, ctrl, 500)
  activeField.value = 'name'
  await typeText(typedName, 'Chanlina Meas', ctrl)
  await sleep(300, ctrl)
  activeField.value = null

  // ⑤ Cursor → course field → type
  const coursePos = getPos(courseFieldRef.value)
  await moveCursor(coursePos.x, coursePos.y, ctrl, 400)
  activeField.value = 'course'
  await typeText(typedCourse, 'Graphic Design', ctrl)
  await sleep(300, ctrl)
  activeField.value = null

  // ⑥ Cursor → Issue confirm button → click
  const confirmPos = getPos(confirmBtnRef.value)
  await moveCursor(confirmPos.x, confirmPos.y, ctrl, 550)
  confirmHovered.value = true
  await sleep(350, ctrl)
  confirmPressed.value = true
  await sleep(120, ctrl)
  confirmPressed.value = false
  confirmHovered.value = false
  await sleep(200, ctrl)

  // ⑦ Modal closes
  showForm.value = false
  await sleep(420, ctrl)

  // ⑧ New row slides in
  newRow.value = true
  await nextTick()
  await sleep(60, ctrl)
  newRowVisible.value = true
  await sleep(800, ctrl)

  // ⑨ Chip: Pending → Valid
  newRowStatus.value = 'Valid'
  await sleep(700, ctrl)

  // ⑩ Hold
  await sleep(2800, ctrl)

  // ⑪ Row fades out
  newRowVisible.value = false
  await sleep(420, ctrl)
  newRow.value = false
  await sleep(80, ctrl)

  // ⑫ Cursor snaps to rest
  cursorTransition.value = 'none'
  cursorX.value = 20
  cursorY.value = 100
  await sleep(400, ctrl)
}

// ── Loop control ───────────────────────────────────────────────────────────

let isVisible  = false
let activeCtrl: Ctrl = { aborted: true }
let isLooping  = false

async function startLoop() {
  if (isLooping) return
  isLooping = true
  while (isVisible && !prefersReducedMotion.value) {
    activeCtrl = { aborted: false }
    try {
      await runScene(activeCtrl)
    } catch {
      break
    }
    if (isVisible) await new Promise<void>(r => setTimeout(r, 300))
  }
  isLooping = false
}

// Shared IO (threshold 0.4 — its own observer instance in the cache)
useIntersect(dashRef, (entry) => {
  isVisible = entry.isIntersecting
  if (isVisible) {
    startLoop()
  } else {
    activeCtrl.aborted = true
    ;(activeCtrl as any)._cancel?.()
  }
}, 0.4)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion.value) {
    // Static finished state — no cursor, no animation
    newRow.value        = true
    newRowVisible.value = true
    newRowStatus.value  = 'Valid'
    typedName.value     = 'Chanlina Meas'
    typedCourse.value   = 'Graphic Design'
  }
})
</script>

<style scoped>
.dash {
  padding: 96px 40px;
  border-top: 1px solid var(--border);
}

.dash-inner {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 64px;
  align-items: center;
}

/* ── Screen reader only ── */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Copy ── */
.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 12px;
}

.section-headline {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  line-height: 1.2;
  margin: 0 0 16px;
}

.section-body {
  font-size: 16px;
  line-height: 1.65;
  color: var(--text-secondary);
  margin: 0;
}

/* ── Browser chrome ── */
.browser {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(55, 53, 47, 0.07), 0 1px 4px rgba(55, 53, 47, 0.04);
}

.browser-chrome {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--surface-hover);
  border-bottom: 1px solid var(--border);
}

.browser-dots {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot--red    { background: #FF6058; }
.dot--yellow { background: #FFBD2E; }
.dot--green  { background: #27C840; }

.browser-url {
  flex: 1;
  font-size: 11px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  color: var(--text-tertiary);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Browser body ── */
.browser-body {
  padding: 16px;
  position: relative;
  min-height: 280px;
}

/* ── Fake cursor ── */
.fake-cursor {
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  height: 18px;
  pointer-events: none;
  z-index: 20;
  will-change: transform;
}

/* ── Page header — title + the real page's own Issue button, matching the
   layout of pages/issuer/certificates.vue rather than putting the button
   next to search. ── */
.ui-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.ui-page-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.ui-page-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
}

/* ── Filter bar ── */
.ui-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.ui-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--canvas);
  min-width: 0;
}

.ui-search-icon {
  width: 13px;
  height: 13px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.ui-search-placeholder {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-status-select {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--canvas);
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ui-status-chevron {
  width: 11px;
  height: 11px;
  color: var(--text-tertiary);
}

.ui-issue-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.1s ease, transform 0.1s ease;
}

.ui-issue-btn--hovered { background: var(--accent-text); }
.ui-issue-btn--pressed { transform: scale(0.95); }

.ui-issue-icon {
  width: 12px;
  height: 12px;
}

/* ── Issue-certificate modal — a centered dialog over a dimmed backdrop,
   matching how the real page opens this form, rather than an inline strip. ── */
.ui-modal-overlay {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease, background-color 0.28s ease;
}

.ui-modal-overlay--open {
  opacity: 1;
  background-color: rgba(20, 20, 18, 0.32);
  pointer-events: auto;
}

.ui-modal {
  width: 240px;
  background: var(--surface);
  border-radius: 10px;
  box-shadow: 0 20px 44px -14px rgba(20, 20, 18, 0.4);
  padding: 16px;
  transform: scale(0.94) translateY(6px);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.ui-modal-overlay--open .ui-modal {
  transform: scale(1) translateY(0);
}

.ui-modal-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.inline-fields {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.inline-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.inline-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}

.inline-input {
  font-size: 12px;
  color: var(--text-primary);
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 7px;
  min-height: 26px;
  line-height: 1.6;
}

.cursor-blink {
  display: inline-block;
  width: 1.5px;
  height: 11px;
  background: var(--accent);
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blink 0.7s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
}

.inline-issue-btn {
  padding: 4px 12px;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border: none;
  cursor: default;
  transition: background-color 0.1s ease, transform 0.1s ease;
}

.inline-issue-btn--hovered { background: var(--accent-text); }
.inline-issue-btn--pressed  { transform: scale(0.95); }

/* ── Table ── */
.ui-table {
  width: 100%;
  border-collapse: collapse;
}

.ui-table th {
  text-align: left;
  padding: 6px 8px;
  color: var(--text-tertiary);
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.03em;
  border-bottom: 1px solid var(--border);
}

.ui-table td {
  padding: 8px 8px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
}

.ui-table tr:last-child td {
  border-bottom: none;
}

.td-name {
  font-weight: 500;
}

.td-course {
  color: var(--text-secondary);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-date {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.th-actions,
.td-actions {
  width: 1%;
  white-space: nowrap;
}

.ui-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.ui-row-action {
  width: 13px;
  height: 13px;
  color: var(--text-tertiary);
}

.ui-row-action--danger {
  color: var(--status-revoked-text);
  opacity: 0.75;
}

/* ── Status chips ── */
.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  transition: background-color 0.45s ease, color 0.45s ease;
}

.status-chip--valid {
  background: var(--status-valid-bg);
  color: var(--status-valid-text);
}

.status-chip--revoked {
  background: var(--status-revoked-bg);
  color: var(--status-revoked-text);
}

.status-chip--pending {
  background: var(--status-expired-bg);
  color: var(--status-expired-text);
}

/* ── New row entrance/exit ── */
.table-row--new {
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.table-row--new.table-row--visible {
  opacity: 1;
  transform: translateX(0);
}

/* ── Chip pop on Pending → Valid ── */
@media (prefers-reduced-motion: no-preference) {
  .status-chip--valid {
    animation: chipPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes chipPop {
    from { transform: scale(0.85); }
    to   { transform: scale(1); }
  }
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .dash {
    padding: 64px 24px;
  }

  .dash-inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .section-headline {
    font-size: 26px;
  }

  .td-date,
  .ui-page-subtitle,
  .th-actions,
  .td-actions {
    display: none;
  }
}
</style>
