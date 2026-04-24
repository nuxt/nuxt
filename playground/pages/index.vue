<template>
  <div>
    <h1>home</h1>
    <pre>{{ data }}</pre>
  </div>
</template>

<script setup lang="ts">
const routeName = ''
const { data } = useLazyAsyncData(
  `marketing-${routeName}`,
  () => Promise.resolve({ id: 'abc', ok: true }),
  {
    default: () => ({ id: '', ok: false }),
  },
)
</script>
