<template>
  <div>You should not see me</div>
</template>

<script setup>
await navigateTo('/api/test', { external: true })
</script>
