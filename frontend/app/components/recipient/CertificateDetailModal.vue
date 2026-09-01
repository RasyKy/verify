<script setup lang="ts">
import type { HolderCertificate } from '~/composables/useHolderCertificates'

// Lazy, not a static import: renders inside <ClientOnly> already, but a
// static import still bundles the ~20KB library into every recipient-
// dashboard visit's chunk whether or not this modal is ever opened. Same
// pattern as the QR *scanner* in components/verify/QrScannerModal.vue.
const QrcodeVue = defineAsyncComponent(() => import('qrcode.vue'))

const props = defineProps<{ open: boolean; cert: HolderCertificate | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const copied = ref<'id' | 'url' | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copy(which: 'id' | 'url', value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = which
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = null), 1600)
  } catch {
    // Clipboard is permission-gated and blocked outside a secure context;
    // the value is on screen and selectable either way.
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))

const certUrl = computed(() => (props.cert ? `${useRequestURL().origin}/cert/${props.cert.id}` : ''))

// Rendered server-side (GET /api/certificates/:id/download) — a plain link,
// since the browser handles the Content-Disposition download natively, no
// JS fetch needed. Public and unauthenticated, same as the QR endpoint.
const { public: { apiBase } } = useRuntimeConfig()
function downloadUrl(format: 'pdf' | 'png') {
  return props.cert ? `${apiBase}/api/certificates/${props.cert.id}/download?format=${format}` : ''
}

// Same endpoint as the "Download PNG" button — an <img> tag ignores
// Content-Disposition: attachment, so it renders inline instead of
// triggering a save dialog. Lets the holder see the actual template
// (branding, layout) their institution chose, not just a data card.
// size=full here (unlike the card grid's size=thumb): this is the closest
// look a holder gets without actually downloading, worth the full render.
const previewLoaded = ref(false)
const previewFailed = ref(false)
const previewAttempt = ref(0)
let previewRetryTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.cert?.id, () => {
  previewLoaded.value = false
  previewFailed.value = false
  previewAttempt.value = 0
  clearTimeout(previewRetryTimer)
})

onBeforeUnmount(() => clearTimeout(previewRetryTimer))

/**
 * The render endpoint is a live, uncached Puppeteer screenshot — a cold
 * backend or a momentarily-queued render can fail the very first attempt
 * even though the same certificate renders fine a moment later (see
 * CertificateCard.vue for the full reasoning). One automatic retry after a
 * short delay covers that invisibly; retryPreview() is the manual escape
 * hatch if it fails twice.
 */
const previewUrl = computed(() => {
  if (!props.cert) return ''
  const base = downloadUrl('png')
  return previewAttempt.value > 0 ? `${base}&retry=${previewAttempt.value}` : base
})

function onPreviewError() {
  if (previewAttempt.value < 1) {
    previewRetryTimer = setTimeout(() => { previewAttempt.value++ }, 1400)
  } else {
    previewFailed.value = true
  }
}

function retryPreview() {
  previewFailed.value = false
  previewAttempt.value++
}

// LinkedIn's certification "Add to Profile" flow, not the generic link-share
// flow — this pre-fills a Licenses & Certifications entry with the cert's own
// details rather than just posting a link.
// https://www.linkedin.com/help/linkedin/answer/a566056
const linkedInShareUrl = computed(() => {
  if (!props.cert) return ''
  const issued = new Date(props.cert.issued_at)
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: props.cert.course_name,
    organizationName: props.cert.institution_name,
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: certUrl.value,
    certId: props.cert.id,
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}
</script>

<template>
  <UModal :open="open" title="Certificate details" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="cert" class="space-y-4">
        <!-- The rendered template itself, not just a data summary — this is
             what downloading actually produces. -->
        <div class="preview-frame">
          <div v-if="!previewLoaded && !previewFailed" class="preview-skeleton" />
          <div v-if="previewFailed" class="preview-fallback">
            <p>Preview unavailable right now. The PDF/PNG downloads below still work.</p>
            <button type="button" class="preview-retry" @click="retryPreview">Retry</button>
          </div>
          <img
            v-show="previewLoaded"
            :src="previewUrl"
            :alt="`${cert.course_name} certificate`"
            class="preview-image"
            @load="previewLoaded = true"
            @error="onPreviewError"
          >
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs mb-0.5 detail-label">Course</p>
            <p class="text-sm font-medium detail-value">{{ cert.course_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Institution</p>
            <p class="text-sm font-medium detail-value">{{ cert.institution_name }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Status</p>
            <UiStatusChip :status="cert.status" />
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Completion date</p>
            <p class="text-sm font-medium detail-value">{{ formatDate(cert.completion_date) }}</p>
          </div>
          <div>
            <p class="text-xs mb-0.5 detail-label">Expiry date</p>
            <p class="text-sm font-medium detail-value">{{ cert.expiry_date ? formatDate(cert.expiry_date) : 'No expiry' }}</p>
          </div>
        </div>

        <!--
          The ID and the link are the two things a holder is asked for, so both
          copy in one click. Reading a UUID off the screen to type elsewhere is
          where verification actually falls down.
        -->
        <div class="pt-5 detail-divider space-y-4">
          <div>
            <p class="section-label mb-1.5">Certificate ID</p>
            <div class="copy-row">
              <code class="copy-value">{{ cert.id }}</code>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="copied === 'id' ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
                :aria-label="copied === 'id' ? 'Certificate ID copied' : 'Copy certificate ID'"
                @click="copy('id', cert.id)"
              />
            </div>
          </div>

          <div>
            <p class="section-label mb-1.5">Verification link</p>
            <div class="copy-row">
              <code class="copy-value">{{ certUrl }}</code>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :icon="copied === 'url' ? 'i-heroicons-check' : 'i-heroicons-square-2-stack'"
                :aria-label="copied === 'url' ? 'Link copied' : 'Copy verification link'"
                @click="copy('url', certUrl)"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-5 pt-5 detail-divider">
          <ClientOnly>
            <QrcodeVue :value="certUrl" :size="140" level="M" />
            <template #fallback>
              <div class="qr-placeholder" />
            </template>
          </ClientOnly>
          <div class="flex-1 space-y-3 min-w-0">
            <p class="section-label">Share &amp; verify</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                :to="linkedInShareUrl"
                target="_blank"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-heroicons-arrow-up-on-square"
              >
                Share to LinkedIn
              </UButton>
              <UButton
                :to="downloadUrl('pdf')"
                target="_blank"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-heroicons-document-arrow-down"
              >
                Download PDF
              </UButton>
              <UButton
                :to="downloadUrl('png')"
                target="_blank"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-heroicons-photo"
              >
                Download PNG
              </UButton>
            </div>
            <p v-if="cert.status === 'valid'" class="onchain-note">
              <UIcon name="i-heroicons-check-badge" class="size-3.5 shrink-0" />
              On-chain · {{ formatTimestamp(cert.issuedAtBlockchainTimestamp) }}
            </p>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between w-full">
        <UButton
          variant="ghost"
          color="neutral"
          :to="`/cert/${cert?.id}`"
          target="_blank"
          icon="i-heroicons-arrow-top-right-on-square"
        >
          Open public page
        </UButton>
        <UButton color="neutral" variant="outline" @click="emit('update:open', false)">Close</UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.copy-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-hover);
}

.copy-value {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Section labels — small bold uppercase headers, same voice as the
   dashboard's eyebrow text, used to introduce a block instead of a
   full sentence of instructions. ── */
.section-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.preview-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1.414 / 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-hover);
  border: 1px solid var(--border);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--surface-hover) 25%, var(--surface) 50%, var(--surface-hover) 75%);
  background-size: 200% 100%;
  animation: preview-shimmer 1.4s ease-in-out infinite;
}

@keyframes preview-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.preview-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 24px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

.preview-fallback p {
  margin: 0;
}

.preview-retry {
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--accent-text);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.preview-retry:hover {
  color: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .preview-skeleton { animation: none; }
}

.detail-label { color: var(--text-tertiary); }
.detail-value { color: var(--text-primary); }
.detail-divider { border-top: 1px solid var(--border); }
.onchain-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-tertiary);
}
.qr-placeholder { width: 140px; height: 140px; background: var(--surface-hover); border-radius: 0.5rem; }
</style>
