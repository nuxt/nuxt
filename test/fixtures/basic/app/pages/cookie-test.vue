<script setup lang="ts">
const result = await useFetch('/api/cookie-test', {
  method: 'POST',
})
</script>

<template>
  <div>
    <h1>Cookie Test</h1>
    <p>Counter: {{ result.data?.value?.count }}</p>
  </div>
</template>
