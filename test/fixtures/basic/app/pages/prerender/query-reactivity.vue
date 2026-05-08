<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div :style="{ color: route.query.active === 'true' ? 'red' : 'blue' }">
    Query: {{ route.query.active }}
  </div>
</template>
