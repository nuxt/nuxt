<script setup lang="ts">
await useAsyncData(async () => {
  await new Promise((r) => { setTimeout(r, 50) })
  return 42
})
</script>

<template>
  <div data-testid="content">
    app content
  </div>
</template>

<style scoped>

</style>
