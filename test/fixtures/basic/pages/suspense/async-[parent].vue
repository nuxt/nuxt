<script setup lang="ts">
process.client && console.log('[async]')
const route = useRoute('suspense-async-parent')
await new Promise(resolve => setTimeout(resolve, 100))
process.client && console.log('[async] running async data')
</script>

<template>
  <main :id="route.path.replace(/[/-]+/g, '-')">
    Async parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </main>
</template>
