<template>
  <div>
    keep-alive
  </div>
</template>

<script setup lang="ts">
useAsyncData('useAsyncData:keepalive', () => {
  console.log('[useAsyncData] execute async data')
  return Promise.resolve('data')
}, { server: false })
</script>
