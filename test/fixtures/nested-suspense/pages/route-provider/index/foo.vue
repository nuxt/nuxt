<script setup lang="ts">
const route = useRoute()
await new Promise(resolve => setTimeout(resolve, 100))
</script>

<template>
  <div data-testid="foo">
    foo: {{ $route.path }} - {{ route.path }}
  </div>
</template>

<style scoped>

</style>
