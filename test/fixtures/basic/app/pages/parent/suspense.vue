<template>
  <div>
    parent/suspense
  </div>
</template>

<script setup lang="ts">
await new Promise(resolve => setTimeout(resolve, 1))
</script>
