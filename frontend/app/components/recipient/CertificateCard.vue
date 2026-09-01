<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

const props = defineProps<{ cert: HolderCertificate }>()
const emit = defineEmits<{ view: [id: string]; 'toggle-hidden': [id: string, isHidden: boolean] }>()

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// The one date that actually changes what a viewer needs to know: when it
// expires, if it does — otherwise when it was issued. Showing both was
// redundant since completion/issue dates track each other closely anyway.
const dateLine = computed(() =>
  props.cert.expiry_date
    ? `Expires ${formatDate(props.cert.expiry_date)}`
    : `Issued ${formatDate(props.cert.issued_at)}`,
)

// Same endpoint the detail modal uses for its live preview — an <img> tag
// ignores the response's Content-Disposition: attachment, so it renders
// inline. size=thumb: a card-sized render doesn't need the same resolution
// a real download does — see certificateRender.js's renderPng() for what
// that trades away (nothing but raster resolution; layout is identical).
const { public: { apiBase } } = useRuntimeConfig()
const thumbUrl = `${apiBase}/api/certificates/${props.cert.id}/download?format=png&size=thumb`

const thumbEl = ref<HTMLElement | null>(null)
const thumbSrc = ref<string | null>(null)
const thumbLoaded = ref(false)
const thumbFailed = ref(false)

/*
 * Each thumbnail is a real (size=thumb) Puppeteer render, downscaled further
 * into a small card. Wiring `<img :src>` directly and swapping the skeleton
 * on `@load` still let the browser start painting the element as bytes
 * streamed in — visible as a soft/misaligned frame for a moment before it
 * snapped to the final crisp render (worse on a slow/cold render, which a
 * hover often lands right in the middle of). `decode()` on an off-screen
 * Image resolves only once the bitmap is fully decoded, so the <img> below
 * is never inserted until there's nothing left to stream in — one atomic
 * reveal instead of a partial one settling into a final one.
 *
 * IntersectionObserver replaces `loading="lazy"` as the trigger, since lazy
 * only applies to an <img>'s own src fetch — this needs to gate a manual
 * preload instead, for the same reason (each render costs the backend a
 * real Puppeteer run — see certificates.js's download route for the
 * 5-minute browser Cache-Control that's the only caching involved; there is
 * no server-side render cache).
 */
let observer: IntersectionObserver | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (!thumbEl.value) return
  observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    observer?.disconnect()
    loadThumb()
  }, { rootMargin: '200px' })
  observer.observe(thumbEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(retryTimer)
})

/**
 * The render endpoint is a live, uncached Puppeteer screenshot (see the URL
 * comment above) — a cold backend or a momentarily-queued render can fail
 * the very first attempt even though the same certificate renders fine a
 * moment later, which is why a manual page refresh "fixes" a preview that
 * was never actually broken. One automatic retry after a short delay covers
 * that invisibly instead of leaving the card permanently stuck; the retry
 * link in the fallback is the manual escape hatch if it fails twice.
 */
async function loadThumb(attempt = 0) {
  try {
    const url = attempt > 0 ? `${thumbUrl}&retry=${attempt}` : thumbUrl
    const preload = new Image()
    preload.src = url
    await preload.decode()
    thumbSrc.value = url
    thumbLoaded.value = true
    thumbFailed.value = false
  } catch {
    if (attempt < 1) {
      retryTimer = setTimeout(() => loadThumb(attempt + 1), 1400)
    } else {
      thumbFailed.value = true
    }
  }
}
</script>

<template>
  <div class="cert-card rounded-xl flex flex-col overflow-hidden">
    <div ref="thumbEl" class="cert-thumb">
      <!-- Only mounted once `loadThumb()` has already fully decoded it off-
           screen — see the comment above `loadThumb()`. -->
      <img
        v-if="thumbSrc"
        :src="thumbSrc"
        :alt="`${cert.course_name} certificate`"
        class="thumb-image"
      >
      <div v-if="!thumbLoaded && !thumbFailed" class="thumb-skeleton" />
      <div v-if="thumbFailed" class="thumb-fallback">
        <p>Preview unavailable</p>
        <button type="button" class="thumb-retry" @click="loadThumb()">Retry</button>
      </div>
    </div>

    <div class="p-5 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-2">
        <UAvatar
          v-if="cert.institution_logo_url"
          :src="cert.institution_logo_url"
          :alt="cert.institution_name ?? ''"
          class="size-9 shrink-0 institution-avatar"
        />
        <UAvatar
          v-else
          icon="i-heroicons-academic-cap"
          class="size-9 shrink-0"
          style="background: var(--accent-light); color: var(--accent)"
        />
        <UiStatusChip :status="cert.status" class="shrink-0" />
      </div>

      <div class="min-w-0">
        <p class="text-sm font-semibold truncate card-title">{{ cert.course_name }}</p>
        <p class="text-xs truncate card-subtitle">{{ cert.institution_name }}</p>
      </div>

      <p class="text-xs card-meta">{{ dateLine }}</p>

      <div class="flex items-center justify-between pt-3 card-footer">
        <USwitch
          :model-value="!cert.is_hidden"
          :label="cert.is_hidden ? 'Hidden' : 'Public'"
          size="sm"
          @update:model-value="(isPublic) => emit('toggle-hidden', cert.id, !isPublic)"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="i-heroicons-arrow-right"
          @click="emit('view', cert.id)"
        >
          View details
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cert-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-panel);
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}
.cert-card:hover {
  box-shadow: var(--shadow-panel-hover);
  transform: translateY(-2px);
}
.card-title { color: var(--text-primary); }
.card-subtitle { color: var(--text-secondary); }
.card-meta { color: var(--text-tertiary); }
.card-footer { border-top: 1px solid var(--border); }

.institution-avatar {
  background: var(--surface);
  border: 1px solid var(--border);
  object-fit: contain;
  padding: 4px;
}

/* ── Template thumbnail ── */
.cert-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1.7 / 1;
  background: var(--surface-hover);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.thumb-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--surface-hover) 25%, var(--surface) 50%, var(--surface-hover) 75%);
  background-size: 200% 100%;
  animation: thumb-shimmer 1.4s ease-in-out infinite;
}

@keyframes thumb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.thumb-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.thumb-fallback p {
  margin: 0;
}

.thumb-retry {
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent-text);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.thumb-retry:hover {
  color: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .thumb-skeleton { animation: none; }
}
</style>
