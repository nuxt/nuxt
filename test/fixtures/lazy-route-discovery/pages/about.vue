<script setup lang="ts">
definePageMeta({
  title: 'lazy-about-title',
})

const route = useRoute()
</script>

<template>
  <h1 id="page">
    about-page:{{ route.meta.title }}
  </h1>
</template>
