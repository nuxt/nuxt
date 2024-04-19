<script setup lang="ts">
const { data, pending, error, refresh } = await useAsyncData(async () => {
  // do something
});
</script>

<template>
  <div v-if="pending">
    Waiting for data
  </div>
  <pre v-else>
    {{ data }}
  </pre>
</template>

<style scoped>
:root {
  font-family: 'Inter var';
}
</style>
