<script setup lang="ts">
interface Certificate {
  studentName: string
  courseName: string
  institutionName: string
  completionDate: string
  expiryDate: string | null
  certId: string
  issuedAtBlockchainTimestamp: string
}

interface VerifyResult {
  status: 'verified' | 'invalid' | 'revoked' | 'expired'
  certificate: Certificate | null
}

defineProps<{
  result: VerifyResult | null
  loading: boolean
}>()

const statusConfig = {
  verified: {
    icon: 'i-heroicons-check-circle',
    iconClass: 'bg-green-50 text-green-600',
    heading: 'Certificate verified',
    headingClass: 'text-green-700',
    body: null,
    showDetails: true,
  },
  invalid: {
    icon: 'i-heroicons-x-circle',
    iconClass: 'bg-red-50 text-red-600',
    heading: 'Certificate not found',
    headingClass: 'text-red-700',
    body: "We couldn't verify a certificate with this ID. Please check the ID and try again.",
    showDetails: false,
  },
  revoked: {
    icon: 'i-heroicons-exclamation-triangle',
    iconClass: 'bg-amber-50 text-amber-600',
    heading: 'Certificate revoked',
    headingClass: 'text-amber-700',
    body: 'This certificate has been revoked by the issuing institution and is no longer valid.',
    showDetails: true,
  },
  expired: {
    icon: 'i-heroicons-clock',
    iconClass: 'bg-gray-100 text-gray-600',
    heading: 'Certificate expired',
    headingClass: 'text-gray-700',
    body: 'This certificate was valid but has passed its expiration date.',
    showDetails: true,
  },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="bg-white border border-gray-200 rounded-lg p-8">
    <div class="flex flex-col items-center mb-6">
      <div class="w-16 h-16 rounded-full bg-gray-200 animate-pulse mb-4" />
      <div class="h-5 w-48 bg-gray-200 rounded animate-pulse mb-2" />
      <div class="h-4 w-64 bg-gray-200 rounded animate-pulse" />
    </div>
    <div class="space-y-3">
      <div v-for="i in 5" :key="i" class="grid grid-cols-2 gap-4 py-2 border-t border-gray-100">
        <div class="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
        <div class="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
    </div>
  </div>

  <!-- Result card -->
  <div v-else-if="result" class="bg-white border border-gray-200 rounded-lg p-8">
    <!-- Status icon + heading -->
    <div class="flex flex-col items-center text-center mb-6">
      <div :class="['w-16 h-16 rounded-full flex items-center justify-center mb-4', statusConfig[result.status].iconClass]">
        <UIcon :name="statusConfig[result.status].icon" class="size-8" />
      </div>
      <h2 :class="['text-lg font-semibold', statusConfig[result.status].headingClass]">
        {{ statusConfig[result.status].heading }}
      </h2>
      <p v-if="statusConfig[result.status].body" class="text-sm text-gray-600 mt-2 max-w-sm">
        {{ statusConfig[result.status].body }}
      </p>
    </div>

    <!-- Details list (shown for verified, revoked, expired) -->
    <dl
      v-if="statusConfig[result.status].showDetails && result.certificate"
      class="divide-y divide-gray-100"
    >
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Student name</dt>
        <dd class="text-sm font-medium text-gray-900">{{ result.certificate.studentName }}</dd>
      </div>
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Course</dt>
        <dd class="text-sm text-gray-900">{{ result.certificate.courseName }}</dd>
      </div>
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Institution</dt>
        <dd class="text-sm text-gray-900">{{ result.certificate.institutionName }}</dd>
      </div>
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Completion date</dt>
        <dd class="text-sm text-gray-900">{{ formatDate(result.certificate.completionDate) }}</dd>
      </div>
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Expiry date</dt>
        <dd class="text-sm text-gray-900">
          {{ result.certificate.expiryDate ? formatDate(result.certificate.expiryDate) : 'No expiry' }}
        </dd>
      </div>
      <div class="py-2.5 grid grid-cols-2 gap-x-4">
        <dt class="text-sm text-gray-500">Certificate ID</dt>
        <dd class="text-xs font-mono text-gray-700 break-all pt-0.5">{{ result.certificate.certId }}</dd>
      </div>
    </dl>

    <!-- Blockchain footer (verified only) -->
    <p
      v-if="result.status === 'verified' && result.certificate?.issuedAtBlockchainTimestamp"
      class="text-xs text-gray-400 text-center mt-5 pt-4 border-t border-gray-100"
    >
      Recorded on the Polygon blockchain ·
      {{ formatTimestamp(result.certificate.issuedAtBlockchainTimestamp) }}
    </p>
  </div>
</template>

