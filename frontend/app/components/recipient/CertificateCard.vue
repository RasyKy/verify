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
// inline.
const { public: { apiBase } } = useRuntimeConfig()
const thumbUrl = `${apiBase}/api/certificates/${props.cert.id}/download?format=png`

const thumbEl = ref<HTMLElement | null>(null)
const thumbSrc = ref<string | null>(null)
const thumbLoaded = ref(false)
const thumbFailed = ref(false)

/*
 * Each thumbnail is a real ~3200x2262 Puppeteer render, downscaled ~9x into
 * a small card. Wiring `<img :src>` directly and swapping the skeleton on
 * `@load` still let the browser start painting the element as bytes streamed
 * in — visible as a soft/misaligned frame for a moment before it snapped to
 * the final crisp render (worse on the first, uncached hit, which a hover
 * often lands right in the middle of). `decode()` on an off-screen Image
 * resolves only once the bitmap is fully decoded, so the <img> below is
 * never inserted until there's nothing left to stream in — one atomic reveal
 * instead of a partial one settling into a final one.
 *
 * IntersectionObserver replaces `loading="lazy"` as the trigger, since lazy
 * only applies to an <img>'s own src fetch — this needs to gate a manual
 * preload instead, for the same reason (each render costs the backend a
 * real Puppeteer run, cached 5 min server-side after the first).
 */
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!thumbEl.value) return
  observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    observer?.disconnect()
    loadThumb()
  }, { rootMargin: '200px' })
  observer.observe(thumbEl.value)
})

onBeforeUnmount(() => observer?.disconnect())

async function loadThumb() {
  try {
    const preload = new Image()
    preload.src = thumbUrl
    await preload.decode()
    thumbSrc.value = thumbUrl
    thumbLoaded.value = true
  } catch {
    thumbFailed.value = true
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
      <p v-if="thumbFailed" class="thumb-fallback">Preview unavailable</p>
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
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .thumb-skeleton { animation: none; }
}
</style>
