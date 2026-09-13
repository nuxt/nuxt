<script setup lang="ts">
definePageMeta({
  layout: 'other',
})

// Suspends on client-side navigation until the test calls
// `window.__releaseTarget()`, so the test can navigate again while this page
// is still pending.
await useTestGate('__releaseTarget')
</script>

<template>
  <h1 data-testid="async-target-other-title">
    async target page in other layout
  </h1>
</template>
