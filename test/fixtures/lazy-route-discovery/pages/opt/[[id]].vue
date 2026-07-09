<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <h1 id="page">
    opt-{{ route.params.id || 'none' }}
  </h1>
</template>
