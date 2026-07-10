<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'light'
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UToaster />
  </div>
</template>
