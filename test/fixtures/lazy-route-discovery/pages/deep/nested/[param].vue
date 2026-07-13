<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <h1 id="page">
    deep-{{ route.params.param }}
  </h1>
</template>
