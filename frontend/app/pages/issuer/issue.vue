<script setup lang="ts">
definePageMeta({ layout: 'issuer' })
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-8">
      <h1 class="text-xl font-medium text-gray-900">Issue certificate</h1>
      <p class="mt-1 text-sm text-gray-500">
        Fill in the details to issue a new certificate to a student.
      </p>
    </div>
    <IssuerCertificateForm @cancel="navigateTo('/issuer')" />
  </div>
</template>
