<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>generated-{{ route.path }}</div>
</template>
