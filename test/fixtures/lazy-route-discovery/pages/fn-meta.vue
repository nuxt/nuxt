<script setup lang="ts">
definePageMeta({
  // non-serializable meta: extracted at runtime from the macro chunk, page stays lazily discoverable
  key: route => route.fullPath,
  title: 'lazy-fn-meta-title',
})

const route = useRoute()
</script>

<template>
  <h1 id="page">
    fn-meta:{{ route.meta.title }}
  </h1>
</template>
