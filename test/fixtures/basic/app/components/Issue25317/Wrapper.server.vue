<script setup lang="ts">
await new Promise<void>((resolve) => {
  setTimeout(() => resolve(), 20)
})
</script>

<template>
  <Issue25317Inner />
</template>
