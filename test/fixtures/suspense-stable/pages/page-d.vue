<script setup lang="ts">
definePageMeta({
  stableContent: true,
})

// Simulate slow async data loading (300ms)
await new Promise(resolve => setTimeout(resolve, 300))
</script>

<template>
  <div>
    <h1 data-testid="page-d-title">Page D</h1>
    <p data-testid="page-d-content">Content from page D (stableContent via definePageMeta)</p>
    <NuxtLink to="/" data-testid="back-home">
      Back to Home
    </NuxtLink>
  </div>
</template>
