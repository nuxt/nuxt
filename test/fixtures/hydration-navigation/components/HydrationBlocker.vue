<script setup lang="ts">
// On the client this component suspends until the test calls
// `window.__releaseHydration()`, so the page it sits in stays mid-hydration
// for as long as the test needs. On the server it renders immediately.
await useTestGate('__releaseHydration')
</script>

<template>
  <div data-testid="hydration-blocker">
    hydration finished
  </div>
</template>
