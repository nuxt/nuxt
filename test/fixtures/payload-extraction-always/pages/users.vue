<script setup>
const { data } = await useAsyncData('users', () => Promise.resolve([
  {
    name: 'Ada',
  },
]))
</script>

<template>
  <pre>{{ data }}</pre>
</template>
