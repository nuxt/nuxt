<script setup lang="ts">
const route = useRoute()
const slug = computed(() => Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug)
</script>

<template>
  <h1 id="page">
    catchall-{{ slug }}
  </h1>
</template>
