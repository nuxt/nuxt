<script setup lang="ts">
// Top-level await - triggers Suspense
const { data } = await useFetch('/api/slow')
console.log('page loaded')
</script>

<template>
  <div data-testid="content">
    {{ data?.message }}
  </div>
</template>
