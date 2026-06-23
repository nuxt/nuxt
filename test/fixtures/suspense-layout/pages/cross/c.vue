<script setup lang="ts">
await useAsyncData('cross-c', async () => {
  await new Promise(resolve => setTimeout(resolve, 5000))
  return 'c'
})
</script>

<template>
  <div data-testid="cross-c">
    Page C
  </div>
</template>