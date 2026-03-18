<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>
    <div>Should use layout set in route-rules</div>
    <div data-testid="layout-meta">{{ route.meta.layout }}</div>
  </div>
</template>
