<script setup lang="ts">
console.log('[async]')
const route = useRoute('suspense-async-parent')
await useAsyncData(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
  console.log('[async] running async data')
  return {}
})
</script>
<template>
  <div>
    Async parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </div>
</template>
