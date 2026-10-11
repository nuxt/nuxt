<template>
  <div data-testid="never-rendered">
    unreachable
  </div>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, import.meta.server ? 150 : 0))

useHead({
  meta: [{ name: 'description', content: 'Held error description' }],
  script: [{ type: 'application/ld+json', innerHTML: '{"@type":"Product","name":"Held Error Product"}' }],
})

if (import.meta.server) {
  throw createError({ statusCode: 500, statusMessage: 'Late tags render failure', fatal: true })
}
</script>
