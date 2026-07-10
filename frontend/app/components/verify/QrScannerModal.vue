<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean] }>()

const videoEl = ref<HTMLVideoElement | null>(null)
const cameraError = ref(false)
let scanner: any = null

watch(
  () => props.open,
  async (isOpen) => {
    if (!import.meta.client) return

    if (isOpen) {
      cameraError.value = false
      await nextTick()
      try {
        const { default: QrScanner } = await import('qr-scanner')
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) {
          cameraError.value = true
          return
        }
        scanner = new QrScanner(
          videoEl.value!,
          (result: { data: string }) => onScan(result.data),
          { preferredCamera: 'environment', highlightScanRegion: true },
        )
        await scanner.start()
      } catch {
        cameraError.value = true
      }
    } else {
      scanner?.stop()
      scanner?.destroy()
      scanner = null
    }
  },
)

function onScan(data: string) {
  try {
    const url = new URL(data)
    const certId = url.pathname.split('/').pop()
    if (certId) {
      close()
      navigateTo(`/verify/${certId}`)
    }
  } catch {
    // not a URL — keep scanning
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    title="Scan QR code"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!-- Camera error / no camera -->
      <div v-if="cameraError" class="flex flex-col items-center text-center py-6 px-4">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-camera" class="size-6 text-gray-400" />
        </div>
        <p class="text-sm font-medium text-gray-900 mb-1">Camera not available</p>
        <p class="text-sm text-gray-500">
          Camera access is needed to scan a QR code. You can also enter the certificate ID manually below.
        </p>
      </div>

      <!-- Camera viewfinder -->
      <div v-else class="space-y-3">
        <video
          ref="videoEl"
          class="w-full rounded-lg aspect-video object-cover bg-gray-900"
          playsinline
          muted
        />
        <p class="text-xs text-gray-500 text-center">
          Point your camera at a Verify QR code.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end w-full">
        <UButton variant="outline" color="neutral" @click="close">
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>
