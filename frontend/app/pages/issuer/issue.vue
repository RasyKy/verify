<script setup lang="ts">
definePageMeta({ layout: 'issuer' })
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-8">
      <h1 class="text-2xl font-bold page-title">Issue certificate</h1>
      <p class="mt-1 text-sm page-subtitle">
        Fill in the details to issue a new certificate to a student.
      </p>
    </div>
    <IssuerCertificateForm @cancel="navigateTo('/issuer')" />
  </div>
</template>

<style scoped>
.page-title {
  color: var(--text-primary);
}

.page-subtitle {
  color: var(--text-secondary);
}
</style>
