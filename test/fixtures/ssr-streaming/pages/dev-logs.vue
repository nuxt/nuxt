<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, 10))
console.warn('logged during streamed render')
</script>

<template>
  <div>
    <h1 data-testid="title">
      Dev Logs
    </h1>
  </div>
</template>
