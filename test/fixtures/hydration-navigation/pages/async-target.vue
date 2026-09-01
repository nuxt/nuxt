<script setup lang="ts">
// Suspends on client-side navigation until the test calls
// `window.__releaseTarget()`, so the test can assert what is shown while the
// target page is still pending.
await useTestGate('__releaseTarget')
</script>

<template>
  <h1 data-testid="async-target-title">
    async target page
  </h1>
</template>
