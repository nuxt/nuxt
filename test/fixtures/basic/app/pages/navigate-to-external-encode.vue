<template>
  <div>You should not see me</div>
</template>

<script setup lang="ts">
await navigateTo('https://example.com/x><img src=x>&"\'', { external: true })
</script>
