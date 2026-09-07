<template>
  <p data-testid="content">
    dedupe-loaded
  </p>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, import.meta.server ? 100 : 0))

useHead({
  script: [
    { key: 'org-schema', type: 'application/ld+json', innerHTML: '{"@type":"Organization","name":"Acme"}' },
    { type: 'application/ld+json', innerHTML: '{"@type":"Product","name":"Dedupe Product"}' },
  ],
})
</script>
