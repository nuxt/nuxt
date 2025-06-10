<script setup lang="ts">
if (import.meta.client) {
  await new Promise<void>((resolve) => {
    document.addEventListener('finishHydration', () => resolve())
  })
}
</script>

<template>
  <div data-testid="content">
    app content
  </div>
</template>
