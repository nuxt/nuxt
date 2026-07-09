<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <h1 id="page">
    dynamic-{{ route.params.id }}
  </h1>
</template>
