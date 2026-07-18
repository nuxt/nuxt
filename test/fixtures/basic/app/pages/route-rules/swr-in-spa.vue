<template>
  <div>
    <h1>SWR-in-SPA Page</h1>
    <pre id="swr-in-spa-data">{{ data }}</pre>
  </div>
</template>

<script setup lang="ts">
const { data } = await useAsyncData('swr-in-spa-data', () => Promise.resolve({ ok: true }))
</script>
