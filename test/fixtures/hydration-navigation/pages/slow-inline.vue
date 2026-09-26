<script setup lang="ts">
// the page component itself suspends (like a page with top-level
// `await useAsyncData()`), so the interrupted branch's root is an async
// component that never rendered
await useTestGate('__releaseHydration')
</script>

<template>
  <div>
    <h1 data-testid="slow-inline-title">
      slow inline page
    </h1>
  </div>
</template>
