<script setup lang="ts">
console.log('[async]')
const route = useRoute('suspense-async-parent')
await new Promise(resolve => setTimeout(resolve, 100))
console.log('[async] running async data')
</script>

<template>
  <div :id="route.path.replace(/[/-]+/g, '-')">
    Async parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </div>
</template>
