<script setup lang="ts">
const { data } = await useFetch('/api/params', { params: { param: 'query-value' } })
</script>

<template>
  <pre id="params">{{ data }}</pre>
</template>
