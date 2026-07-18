<template>
  <div>
    <h1>ISR Page</h1>
    <div id="random-data">
      {{ data }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/random', { key: 'isr-data' })
</script>
