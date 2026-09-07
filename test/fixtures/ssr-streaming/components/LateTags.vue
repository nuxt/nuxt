<template>
  <p data-testid="content">
    late-loaded
  </p>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, import.meta.server ? 100 : 0))

useHead({
  title: 'Late Tags Title',
  meta: [
    { name: 'description', content: 'Late description from suspense' },
    { property: 'og:title', content: 'Late Tags og' },
  ],
  script: [
    { type: 'application/ld+json', innerHTML: '{"@type":"Product","name":"Late Product"}' },
    { id: 'late-body-close', innerHTML: 'globalThis.__lateBodyClose = true', tagPosition: 'bodyClose' },
  ],
  noscript: [{ innerHTML: 'late noscript fallback' }],
})
</script>
