<template>
  <div>{{ data }}</div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData('payload-rules-data', () => Promise.resolve(`payload-rules-${route.params.slug}`))
</script>
