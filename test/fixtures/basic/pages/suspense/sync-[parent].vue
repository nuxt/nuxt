<script setup lang="ts">
console.log('[sync]')
const route = useRoute('suspense-async-parent')
</script>

<template>
  <div :id="route.path.replace(/[/-]+/g, '-')">
    Sync parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </div>
</template>
