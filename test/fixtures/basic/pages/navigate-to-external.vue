<template>
  <div>You should not see me</div>
</template>

<script setup>
await navigateTo('https://example.com/', { external: true, replace: true })
</script>
