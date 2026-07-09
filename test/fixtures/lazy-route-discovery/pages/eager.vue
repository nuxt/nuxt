<script setup lang="ts">
const dynamicName = ['eager', 'page'].join('-')

definePageMeta({
  // non-serializable name: this page cannot be stubbed and stays in the initial bundle
  name: dynamicName,
  title: 'eager-page-title',
})

const route = useRoute()
</script>

<template>
  <h1 id="page">
    eager:{{ route.meta.title }}
  </h1>
</template>
