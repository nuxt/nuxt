<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, 50))
</script>

<template>
  <div>
    Hello {{ Object.keys($route.query).join(',') }}
  </div>
</template>
