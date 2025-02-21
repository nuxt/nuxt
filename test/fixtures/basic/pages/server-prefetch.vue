<template>
  <div>server-prefetch</div>
</template>

<script setup lang="ts">
onServerPrefetch(async () => {
  await 1

  useNuxtApp()
})
</script>
