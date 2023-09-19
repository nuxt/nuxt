<script setup lang="ts">
// eslint-disable-next-line no-console
process.client && console.log('[sync]')
const route = useRoute('suspense-async-parent')
</script>

<template>
  <main :id="route.path.replace(/[/-]+/g, '-')">
    Sync parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </main>
</template>
