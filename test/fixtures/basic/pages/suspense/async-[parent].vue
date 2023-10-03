<script setup lang="ts">
if (import.meta.client) {
  console.log('[async]')
}
const route = useRoute('suspense-async-parent')
await new Promise(resolve => setTimeout(resolve, 100))
if (import.meta.client) {
  console.log('[async] running async data')
}
</script>

<template>
  <main :id="route.path.replace(/[/-]+/g, '-')">
    Async parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </main>
</template>
