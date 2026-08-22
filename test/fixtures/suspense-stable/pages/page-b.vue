<script setup lang="ts">
// Simulate slow async data loading (300ms)
await new Promise(resolve => setTimeout(resolve, 300))
</script>

<template>
  <div>
    <h1 data-testid="page-b-title">Page B</h1>
    <p data-testid="page-b-content">Content from page B</p>
    <NuxtLink to="/" data-testid="back-home">
      Back to Home
    </NuxtLink>
  </div>
</template>
