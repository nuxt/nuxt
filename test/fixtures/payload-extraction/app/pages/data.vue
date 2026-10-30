<script setup lang="ts">
const { data } = await useAsyncData('data-hits', () => $fetch('/api/data'))
</script>

<template>
  <div data-testid="hits">
    {{ data?.hits }}
  </div>
</template>
