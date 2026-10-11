<script setup lang="ts">
const { data } = await useFetch('/api/import-meta-test')
</script>

<template>
  <div>
    server test flag: {{ String(data?.test) }}
  </div>
</template>
