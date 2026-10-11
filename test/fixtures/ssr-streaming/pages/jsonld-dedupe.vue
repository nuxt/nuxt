<template>
  <div>
    <Suspense>
      <LateJsonLd />
      <template #fallback>
        <div data-testid="fallback">
          loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({
  script: [{ key: 'org-schema', type: 'application/ld+json', innerHTML: '{"@type":"Organization","name":"Acme"}' }],
})
</script>
