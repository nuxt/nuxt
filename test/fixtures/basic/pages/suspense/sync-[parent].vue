<script setup lang="ts">
console.log('[sync]')
const route = useRoute('suspense-async-parent')
</script>

<template>
  <div>
    Sync parent: {{ route.params.parent }}
    <hr>
    <NuxtPage />
  </div>
</template>
