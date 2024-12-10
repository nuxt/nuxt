<script setup lang="ts">
if (import.meta.client) {
  await new Promise(resolve => setTimeout(resolve, 50))
}
</script>

<template>
  <div data-testid="content">
    app content
  </div>
</template>

<style scoped>

</style>
