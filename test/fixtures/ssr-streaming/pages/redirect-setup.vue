<script setup lang="ts">
await navigateTo('/', { redirectCode: 307 })
</script>

<template>
  <div>this content must never reach the client</div>
</template>
