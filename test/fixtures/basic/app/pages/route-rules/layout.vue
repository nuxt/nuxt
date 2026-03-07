<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>
    <div>Should use layout set in route-rules</div>
    <div>route-meta-layout:{{ route.meta.layout }}</div>
  </div>
</template>
