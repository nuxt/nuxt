<script setup lang="ts">
// Simulate slow async data loading (300ms)
await new Promise(resolve => setTimeout(resolve, 300))
</script>

<template>
  <div>
    <h1 data-testid="page-a-title">Page A</h1>
    <p data-testid="page-a-content">Content from page A</p>
    <NuxtLink to="/" data-testid="back-home">
      Back to Home
    </NuxtLink>
  </div>
</template>
