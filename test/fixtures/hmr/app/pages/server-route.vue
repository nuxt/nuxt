<script setup lang="ts">
const { data } = await useFetch('/api/hmr-value')
</script>

<template>
  <div data-testid="value">
    {{ data?.value }}
  </div>
</template>
