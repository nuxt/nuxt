<script setup lang="ts">
const pending = 'something-else'
</script>

<template>
  <div v-if="pending">
    Waiting for data
  </div>
</template>

<style scoped>
:root {
  font-family: 'Inter var';
}
</style>



