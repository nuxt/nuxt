<script setup lang="ts">
// regression test for #34279: useAsyncData on an `ssr: false` route should
// not trigger payload extraction during prerender
const { data } = useAsyncData('spa-async-data', () => Promise.resolve({ ok: true }))
</script>

<template>
  <div>spa-async-data: {{ data }}</div>
</template>
